/**
 * Chat Routes (RAG Q&A)
 * 
 * Endpoints for RAG-based question answering
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { geminiRAGService } from '../services/gemini-rag.service.js';
import { qdrantService } from '../services/qdrant.service.js';
import { queryAnalyzerService } from '../services/query-analyzer.service.js';
import { queryPreprocessorService } from '../services/query-preprocessor.service.js';
import { chatCacheService } from '../services/chat-cache.service.js';
import type { RAGQuery, RAGResponse } from '../types/rag.types.js';

const router = Router();
const prisma = new PrismaClient();
const prismaAny = prisma as any; // Type workaround for ChatMessage model

/**
 * Middleware: Require authenticated user
 */
const requireAuth = async (req: Request, res: Response, next: any) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Middleware: Check if chat feature is available (currently admin only)
 */
const requireChatAccess = async (req: Request, res: Response, next: any) => {
  try {
    const userId = (req as any).user?.id;
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    // Currently only admin users have access to chat feature
    if (user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Tính năng chat chỉ dành cho quản trị viên'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * POST /api/chat/ask-stream
 * Ask a question using RAG with streaming response
 */
router.post('/ask-stream', requireAuth, requireChatAccess, async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    const userId = (req as any).user?.id;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
      });
    }

    console.log(`[Chat Stream] User ${userId} asked: "${question.substring(0, 50)}..."`);

    // Check user quota first (admin has unlimited, others use aiSearchQuota)
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        aiSearchQuota: true,
        subscriptions: {
          where: { status: 'active' },
          select: {
            status: true,
            plan: true
          }
        }
      }
    });

    // Admin users have unlimited quota
    const isAdmin = user?.role === 'admin';
    const hasActiveSubscription = user?.subscriptions && user.subscriptions.length > 0;
    const hasUnlimitedAccess = isAdmin || hasActiveSubscription;

    if (!user || (!hasUnlimitedAccess && user.aiSearchQuota <= 0)) {
      return res.status(402).json({
        success: false,
        error: 'Không đủ lượt tìm kiếm. Vui lòng nâng cấp tài khoản.',
        requiresPremium: true
      });
    }

    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Helper to send SSE message
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Check cache first for non-complex queries
      const analysisKeywords = [
        'bao nhiêu', 'có bao nhiêu', 'số lượng', 'đếm',
        'tính tổng', 'tổng cộng', 'tổng số', 'cộng lại',
        'tóm tắt', 'tổng hợp', 'liệt kê tất cả', 'liệt kê toàn bộ',
        'danh sách đầy đủ', 'toàn bộ', 'tất cả các'
      ];

      const questionLower = question.toLowerCase();
      const isComplexQuery = analysisKeywords.some(keyword => questionLower.includes(keyword));

      // Check cache for simple queries (complex queries need fresh analysis)
      if (!isComplexQuery) {
        const cachedResponse = await chatCacheService.getCachedResponse(question);
        if (cachedResponse) {
          sendEvent('status', { message: 'Tìm thấy câu trả lời đã lưu...' });

          // Send cached answer as chunks
          const chunks = cachedResponse.answer.split(' ');
          const wordsPerChunk = 3;
          for (let i = 0; i < chunks.length; i += wordsPerChunk) {
            const chunkText = chunks.slice(i, i + wordsPerChunk).join(' ') + ' ';
            sendEvent('chunk', { text: chunkText });
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming
          }

          // Save cache hit to database
          const chatMessage = await prismaAny.chatMessage.create({
            data: {
              userId,
              userMessage: question,
              botResponse: cachedResponse.answer,
              retrievedChunks: JSON.stringify(cachedResponse.sources),
              modelUsed: cachedResponse.model + ' (cached)',
              inputTokens: 0, // No tokens used for cached response
              outputTokens: 0,
              totalTokens: 0,
              confidence: cachedResponse.confidence,
              cacheHit: true,
              isDeepSearch: false,
            },
          });

          sendEvent('complete', {
            messageId: chatMessage.id,
            confidence: cachedResponse.confidence,
            sources: cachedResponse.sources,
            model: cachedResponse.model + ' (cached)',
            fromCache: true
          });

          console.log(`[Chat Stream] Served from cache for user ${userId}`);
          res.end();
          return;
        }
      }

      // Check if question requires full document analysis

      // Check if question requires full document analysis (after cache check)
      const needsFullDocument = isComplexQuery;

      // Extract document filter if exists (from # selection)
      const documentFilterMatch = question.match(/\[Tìm trong: ([^\]]+)\]/);
      const selectedDocumentNames = documentFilterMatch ? documentFilterMatch[1].split(',').map((s: string) => s.trim()) : null;

      let retrievedChunks;

      if (needsFullDocument && selectedDocumentNames) {
        sendEvent('status', { message: 'Đang tải toàn bộ văn bản...' });

        // Get all chunks from selected documents
        const documents = await (prisma as any).document.findMany({
          where: {
            OR: selectedDocumentNames.map((name: string) => ({
              OR: [
                { documentName: { contains: name } },
                { fileName: { contains: name } }
              ]
            }))
          },
          include: {
            chunks: {
              orderBy: { chunkIndex: 'asc' }
            }
          }
        });

        if (documents.length === 0) {
          sendEvent('error', { message: 'Không tìm thấy tài liệu được chọn.' });
          res.end();
          return;
        }

        // Flatten all chunks
        const allChunks = documents.flatMap((doc: any) =>
          doc.chunks.map((chunk: any) => ({
            chunkId: chunk.id,
            content: chunk.content,
            documentId: doc.id,
            documentName: doc.documentName,
            documentNumber: doc.documentNumber,
            score: 1.0,
            metadata: {
              documentId: doc.id,
              documentNumber: doc.documentNumber,
              documentName: doc.documentName,
              documentType: doc.documentType,
              chapterNumber: chunk.chapterNumber,
              chapterTitle: chunk.chapterTitle,
              articleNumber: chunk.articleNumber,
              articleTitle: chunk.articleTitle,
              sectionNumber: chunk.sectionNumber,
              chunkType: chunk.chunkType,
              chunkIndex: chunk.chunkIndex,
            },
          }))
        );

        retrievedChunks = allChunks;
        console.log(`[Chat Stream] Retrieved ${allChunks.length} chunks for full analysis`);
      } else {
        sendEvent('status', { message: 'Đang phân tích câu hỏi...' });

        // NEW: Get all available collections
        const availableCollections = await qdrantService.listCollections();
        const collectionNames = availableCollections.map(c => c.name);

        console.log(`[Chat Stream] Available collections:`, collectionNames);

        // NEW: Analyze query to determine which collections to search
        const queryAnalysis = await queryAnalyzerService.analyzeQuery(question, collectionNames);
        console.log(`[Chat Stream] Query analysis:`, {
          collections: queryAnalysis.collections,
          confidence: queryAnalysis.confidence.toFixed(2),
          reasoning: queryAnalysis.reasoning,
          searchingAll: queryAnalysis.collections.length === collectionNames.length
        });

        // Display user-friendly message
        const searchMessage = queryAnalysis.collections.length === collectionNames.length
          ? `Tìm kiếm trong tất cả nguồn (độ tin cậy: ${(queryAnalysis.confidence * 100).toFixed(0)}%)`
          : `Tìm kiếm trong: ${queryAnalysis.collections.join(', ')} (độ tin cậy: ${(queryAnalysis.confidence * 100).toFixed(0)}%)`;

        sendEvent('status', { message: searchMessage });

        // NEW: Preprocess query to improve semantic search accuracy
        console.log(`[Chat Stream] Preprocessing query for better semantic matching...`);
        const preprocessResult = await queryPreprocessorService.preprocessQuery(question);
        console.log(`[Chat Stream] Query preprocessing:`, {
          originalQuery: preprocessResult.originalQuery,
          variantCount: preprocessResult.simplifiedQueries.length,
          confidence: preprocessResult.confidence.toFixed(2),
          reasoning: preprocessResult.reasoning
        });

        // Display preprocessing info to user
        if (preprocessResult.simplifiedQueries.length > 1) {
          sendEvent('status', { 
            message: `Đã tối ưu hóa câu hỏi thành ${preprocessResult.simplifiedQueries.length} biến thể tìm kiếm`
          });
        }

        // Generate embeddings for all query variants
        console.log(`[Chat Stream] Generating embeddings for ${preprocessResult.simplifiedQueries.length} query variants...`);
        const allEmbeddings = await Promise.all(
          preprocessResult.simplifiedQueries.map(q => geminiRAGService.generateEmbedding(q))
        );
        
        // Use the first (most important) embedding as primary
        const questionEmbedding = allEmbeddings[0];

        // Extract keywords for debugging
        const queryKeywords = question.toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 2);
        console.log(`[Chat Stream] Query keywords:`, queryKeywords);

        // Determine optimal chunk count based on query complexity
        const isComplexQuery = analysisKeywords.some(kw => questionLower.includes(kw));
        const topK = isComplexQuery ? 20 : 12; // Reduced from 30

        console.log(`[Chat Stream] Query complexity: ${isComplexQuery ? 'COMPLEX' : 'SIMPLE'}, topK: ${topK}`);

        // NEW: For complex queries or low preprocessing confidence, search with multiple query variants
        const shouldUseMultipleVariants = isComplexQuery || preprocessResult.confidence < 0.7;
        
        let searchResults;
        if (shouldUseMultipleVariants && preprocessResult.simplifiedQueries.length > 1) {
          console.log(`[Chat Stream] Using multi-variant search for better coverage`);
          
          // Search with each variant and merge results
          const perVariantTopK = Math.ceil(topK / preprocessResult.simplifiedQueries.length);
          const allResults: any[] = [];
          
          for (let i = 0; i < Math.min(preprocessResult.simplifiedQueries.length, 3); i++) {
            const variantEmbedding = allEmbeddings[i];
            const variantQuery = preprocessResult.simplifiedQueries[i];
            
            console.log(`[Chat Stream]   Searching with variant ${i + 1}: "${variantQuery}"`);
            
            let variantResults;
            if (queryAnalysis.collections.length > 1) {
              variantResults = await qdrantService.searchMultipleCollections(
                variantEmbedding,
                queryAnalysis.collections,
                { topK: perVariantTopK, minScore: 0.5 }
              );
            } else {
              variantResults = await qdrantService.search(
                variantEmbedding,
                {
                  topK: perVariantTopK,
                  minScore: 0.5,
                  collectionName: queryAnalysis.collections[0]
                }
              );
            }
            
            allResults.push(...variantResults);
          }
          
          // Deduplicate and sort by score
          const seenIds = new Set<string>();
          searchResults = allResults
            .filter(r => {
              if (seenIds.has(r.id)) return false;
              seenIds.add(r.id);
              return true;
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
          
          console.log(`[Chat Stream] Multi-variant search: ${allResults.length} → ${searchResults.length} unique results`);
        } else {
          // Standard single-query search
          // NEW: Search across multiple collections (if analysis determined multiple)
          if (queryAnalysis.collections.length > 1) {
            console.log(`[Chat Stream] Searching in multiple collections:`, queryAnalysis.collections);
            searchResults = await qdrantService.searchMultipleCollections(
              questionEmbedding,
              queryAnalysis.collections,
              { topK, minScore: 0.5 }
            );
          } else {
            console.log(`[Chat Stream] Searching in single collection:`, queryAnalysis.collections[0]);
            searchResults = await qdrantService.search(
              questionEmbedding,
              {
                topK,
                minScore: 0.5,
                collectionName: queryAnalysis.collections[0]
              }
            );
          }
        }

        // Detect deposit vs loan queries for smart post-filtering (keep existing logic)
        const depositKeywords = ['tiền gửi', 'gửi tiền', 'tiết kiệm', 'tài khoản tiền gửi'];
        const loanKeywords = ['cho vay', 'vay vốn', 'tín dụng', 'khoản vay', 'nợ'];

        const isDepositQuery = depositKeywords.some(kw => question.toLowerCase().includes(kw));
        const isLoanQuery = loanKeywords.some(kw => question.toLowerCase().includes(kw));

        // Apply smart post-filtering based on query intent
        if (isDepositQuery && !isLoanQuery) {
          console.log(`[Chat Stream] 🏦 DEPOSIT query detected - Filtering out loan documents`);
          searchResults = searchResults.filter((result: any) => {
            const docNameLower = result.payload.documentName.toLowerCase();
            const hasLoanKeyword = ['cho vay', 'vay vốn', 'tín dụng'].some(kw => docNameLower.includes(kw));
            return !hasLoanKeyword; // Exclude loan documents
          });
          console.log(`[Chat Stream]    After filtering: ${searchResults.length} results remain`);
        } else if (isLoanQuery && !isDepositQuery) {
          console.log(`[Chat Stream] 💰 LOAN query detected - Filtering out deposit documents`);
          searchResults = searchResults.filter((result: any) => {
            const docNameLower = result.payload.documentName.toLowerCase();
            const hasDepositKeyword = ['tiền gửi', 'gửi tiền'].some(kw => docNameLower.includes(kw));
            return !hasDepositKeyword; // Exclude deposit documents
          });
          console.log(`[Chat Stream]    After filtering: ${searchResults.length} results remain`);
        }

        // Log original search results
        console.log(`\n[Chat Stream DEBUG] Original Qdrant Search Results (Top 5):`);
        searchResults.slice(0, 5).forEach((result: any, idx: number) => {
          console.log(`  ${idx + 1}. Score: ${result.score.toFixed(4)}`);
          console.log(`     Document: ${result.payload.documentName}`);
          console.log(`     Article: ${result.payload.articleNumber || 'N/A'}`);
          console.log(`     Preview: ${result.payload.content.substring(0, 100)}...`);
        });

        // Apply reranking for better diversity and relevance
        searchResults = qdrantService.rerankResults(searchResults, question, {
          keywordWeight: 0.1, // Small bonus for keyword matches
          maxPerDocument: 5,
        });

        // Log reranked results
        console.log(`\n[Chat Stream DEBUG] After Reranking (Top 5):`);
        searchResults.slice(0, 5).forEach((result: any, idx: number) => {
          const docNameMatch = queryKeywords.some((kw: string) =>
            result.payload.documentName.toLowerCase().includes(kw)
          );
          console.log(`  ${idx + 1}. Score: ${result.score.toFixed(4)} ${docNameMatch ? '✓ [Doc Name Match]' : ''}`);
          console.log(`     Document: ${result.payload.documentName}`);
          console.log(`     Article: ${result.payload.articleNumber || 'N/A'}`);
          console.log(`     Preview: ${result.payload.content.substring(0, 100)}...`);
        });

        // Take top 10 after reranking
        searchResults = searchResults.slice(0, 10);

        if (searchResults.length === 0) {
          sendEvent('error', { message: 'Không tìm thấy thông tin liên quan.' });
          res.end();
          return;
        }

        retrievedChunks = searchResults.map((result: any) => ({
          chunkId: result.id,
          content: result.payload.content,
          documentId: result.payload.documentId,
          documentName: result.payload.documentName,
          documentNumber: result.payload.documentNumber,
          score: result.score,
          metadata: {
            documentId: result.payload.documentId,
            documentNumber: result.payload.documentNumber,
            documentName: result.payload.documentName,
            documentType: result.payload.documentType,
            chapterNumber: result.payload.chapterNumber,
            chapterTitle: result.payload.chapterTitle,
            articleNumber: result.payload.articleNumber,
            articleTitle: result.payload.articleTitle,
            sectionNumber: result.payload.sectionNumber,
            chunkType: result.payload.chunkType,
            chunkIndex: result.payload.chunkIndex,
          },
        }));
      }

      sendEvent('status', { message: 'Đang phân tích và tạo câu trả lời...' });

      // Generate streaming answer
      const query: RAGQuery = {
        question: documentFilterMatch ? question.replace(documentFilterMatch[0], '').trim() : question,
        topK: retrievedChunks.length,
      };

      let fullAnswer = '';
      let streamMetadata: any = null;

      for await (const chunk of geminiRAGService.generateRAGAnswerStream(query, retrievedChunks)) {
        if (chunk.done) {
          streamMetadata = chunk.metadata;
        } else {
          fullAnswer += chunk.chunk;
          sendEvent('chunk', { text: chunk.chunk });
        }
      }

      // Save to database
      const chatMessage = await prismaAny.chatMessage.create({
        data: {
          userId,
          userMessage: question,
          botResponse: fullAnswer,
          retrievedChunks: JSON.stringify(streamMetadata?.sources || []),
          modelUsed: streamMetadata?.model || null,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          confidence: streamMetadata?.confidence || 0,
          cacheHit: false,
          isDeepSearch: false,
        },
      });

      // Cache the response for future use (if high quality and not complex query)
      if (!isComplexQuery && streamMetadata?.confidence >= 70) {
        const ragResponse: RAGResponse = {
          answer: fullAnswer,
          sources: streamMetadata.sources,
          model: streamMetadata.model,
          confidence: streamMetadata.confidence,
          tokenUsage: {
            input: 0,
            output: 0,
            total: 0
          }
        };
        await chatCacheService.setCachedResponse(question, ragResponse);
      }

      // Deduct quota if not admin and not subscription user
      if (!hasUnlimitedAccess) {
        await (prisma as any).user.update({
          where: { id: userId },
          data: { aiSearchQuota: { decrement: 1 } }
        });
        console.log(`[Chat Stream] Deducted 1 quota from user ${userId}, remaining: ${user.aiSearchQuota - 1}`);
      }

      // Send completion event
      sendEvent('complete', {
        messageId: chatMessage.id,
        confidence: streamMetadata?.confidence || 0,
        sources: streamMetadata?.sources || [],
        model: streamMetadata?.model || 'N/A',
        quotaUsed: !hasUnlimitedAccess,
        remainingQuota: hasUnlimitedAccess ? null : user.aiSearchQuota - 1
      });

      console.log(`[Chat Stream] Completed for user ${userId}`);
      res.end();
    } catch (error: any) {
      console.error('[Chat Stream] Error:', error);
      sendEvent('error', { message: error.message || 'Lỗi khi xử lý câu hỏi' });
      res.end();
    }
  } catch (error) {
    console.error('[Chat Stream] Request error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi khi xử lý yêu cầu',
    });
  }
});

/**
 * POST /api/chat/ask
 * Ask a question using RAG (Non-streaming version)
 */
router.post('/ask', requireAuth, requireChatAccess, async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    const userId = (req as any).user?.id;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Question is required',
      });
    }

    console.log(`[Chat] User ${userId} asked: "${question.substring(0, 50)}..."`);

    // Check user quota first (admin has unlimited, others use aiSearchQuota)
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        aiSearchQuota: true,
        subscriptions: {
          where: { status: 'active' },
          select: {
            status: true,
            plan: true
          }
        }
      }
    });

    // Admin users have unlimited quota
    const isAdmin = user?.role === 'admin';
    const hasActiveSubscription = user?.subscriptions && user.subscriptions.length > 0;
    const hasUnlimitedAccess = isAdmin || hasActiveSubscription;

    if (!user || (!hasUnlimitedAccess && user.aiSearchQuota <= 0)) {
      return res.status(402).json({
        success: false,
        error: 'Không đủ lượt tìm kiếm. Vui lòng nâng cấp tài khoản.',
        requiresPremium: true
      });
    }

    // Check if question requires full document analysis
    const analysisKeywords = [
      'bao nhiêu', 'có bao nhiêu', 'số lượng', 'đếm',
      'tính tổng', 'tổng cộng', 'tổng số', 'cộng lại',
      'tóm tắt', 'tổng hợp', 'liệt kê tất cả', 'liệt kê toàn bộ',
      'danh sách đầy đủ', 'toàn bộ', 'tất cả các'
    ];

    const questionLower = question.toLowerCase();
    const needsFullDocument = analysisKeywords.some(keyword => questionLower.includes(keyword));

    // Check cache first for non-complex queries
    if (!needsFullDocument) {
      const cachedResponse = await chatCacheService.getCachedResponse(question);
      if (cachedResponse) {
        // Save cache hit to database
        const chatMessage = await prismaAny.chatMessage.create({
          data: {
            userId,
            userMessage: question,
            botResponse: cachedResponse.answer,
            retrievedChunks: JSON.stringify(cachedResponse.sources),
            modelUsed: cachedResponse.model + ' (cached)',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            confidence: cachedResponse.confidence,
            cacheHit: true,
            isDeepSearch: false,
          },
        });

        // Even for cache hits, deduct quota if not admin/subscription (consistent with camera search behavior)
        if (!hasUnlimitedAccess) {
          await (prisma as any).user.update({
            where: { id: userId },
            data: { aiSearchQuota: { decrement: 1 } }
          });
          console.log(`[Chat] Cache hit - Deducted 1 quota from user ${userId}, remaining: ${user.aiSearchQuota - 1}`);
        }

        return res.json({
          success: true,
          answer: cachedResponse.answer,
          sources: cachedResponse.sources,
          model: cachedResponse.model + ' (cached)',
          confidence: cachedResponse.confidence,
          tokenUsage: { input: 0, output: 0, total: 0 },
          messageId: chatMessage.id,
          fromCache: true,
          quotaUsed: !hasUnlimitedAccess,
          remainingQuota: hasUnlimitedAccess ? null : user.aiSearchQuota - 1
        });
      }
    }

    // Extract document filter if exists (from # selection)
    const documentFilterMatch = question.match(/\[Tìm trong: ([^\]]+)\]/);
    const selectedDocumentNames = documentFilterMatch ? documentFilterMatch[1].split(',').map(s => s.trim()) : null;

    let searchResults;
    let retrievedChunks;

    if (needsFullDocument && selectedDocumentNames) {
      console.log(`[Chat] Full document analysis needed for: ${selectedDocumentNames.join(', ')}`);

      // Get all chunks from selected documents
      const documents = await (prisma as any).document.findMany({
        where: {
          OR: selectedDocumentNames.map((name: string) => ({
            OR: [
              { documentName: { contains: name } },
              { fileName: { contains: name } }
            ]
          }))
        },
        include: {
          chunks: {
            orderBy: { chunkIndex: 'asc' }
          }
        }
      });

      if (documents.length === 0) {
        return res.json({
          success: true,
          answer: 'Không tìm thấy tài liệu được chọn.',
          sources: [],
          model: 'N/A',
          confidence: 0,
          tokenUsage: { input: 0, output: 0, total: 0 },
        });
      }

      // Flatten all chunks
      const allChunks = documents.flatMap((doc: any) =>
        doc.chunks.map((chunk: any) => ({
          chunkId: chunk.id,
          content: chunk.content,
          documentId: doc.id,
          documentName: doc.documentName,
          documentNumber: doc.documentNumber,
          score: 1.0, // Full document, all chunks equally relevant
          metadata: {
            documentId: doc.id,
            documentNumber: doc.documentNumber,
            documentName: doc.documentName,
            documentType: doc.documentType,
            chapterNumber: chunk.chapterNumber,
            chapterTitle: chunk.chapterTitle,
            articleNumber: chunk.articleNumber,
            articleTitle: chunk.articleTitle,
            sectionNumber: chunk.sectionNumber,
            chunkType: chunk.chunkType,
            chunkIndex: chunk.chunkIndex,
          },
        }))
      );

      retrievedChunks = allChunks;
      console.log(`[Chat] Retrieved ${allChunks.length} chunks for full document analysis`);
    } else {
      // NEW: Preprocess query before generating embedding
      console.log(`[Chat] Preprocessing query for better semantic matching...`);
      const preprocessResult = await queryPreprocessorService.preprocessQuery(question);
      console.log(`[Chat] Query preprocessing:`, {
        originalQuery: preprocessResult.originalQuery,
        variantCount: preprocessResult.simplifiedQueries.length,
        confidence: preprocessResult.confidence.toFixed(2),
        reasoning: preprocessResult.reasoning
      });

      // Step 1: Generate embeddings for query variants
      console.log(`[Chat] Generating embeddings for ${preprocessResult.simplifiedQueries.length} query variants...`);
      const allEmbeddings = await Promise.all(
        preprocessResult.simplifiedQueries.map(q => geminiRAGService.generateEmbedding(q))
      );
      const questionEmbedding = allEmbeddings[0];

      // Extract keywords for debugging
      const queryKeywords = question.toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2);
      console.log(`[Chat] Query keywords:`, queryKeywords);

      // Detect deposit vs loan queries for smart post-filtering
      const depositKeywords = ['tiền gửi', 'gửi tiền', 'tiết kiệm', 'tài khoản tiền gửi'];
      const loanKeywords = ['cho vay', 'vay vốn', 'tín dụng', 'khoản vay', 'nợ'];

      const isDepositQuery = depositKeywords.some(kw => question.toLowerCase().includes(kw));
      const isLoanQuery = loanKeywords.some(kw => question.toLowerCase().includes(kw));

      // Determine optimal chunk count based on query complexity
      const isComplexQuery = analysisKeywords.some(kw => questionLower.includes(kw));
      const topK = isComplexQuery ? 20 : 12; // Reduced from 30

      // NEW: For complex queries or low preprocessing confidence, use multi-variant search
      const shouldUseMultipleVariants = isComplexQuery || preprocessResult.confidence < 0.7;
      
      if (shouldUseMultipleVariants && preprocessResult.simplifiedQueries.length > 1) {
        console.log(`[Chat] Using multi-variant search for better coverage`);
        
        // Search with each variant and merge results
        const perVariantTopK = Math.ceil(topK / preprocessResult.simplifiedQueries.length);
        const allResults: any[] = [];
        
        for (let i = 0; i < Math.min(preprocessResult.simplifiedQueries.length, 3); i++) {
          const variantEmbedding = allEmbeddings[i];
          const variantQuery = preprocessResult.simplifiedQueries[i];
          
          console.log(`[Chat]   Searching with variant ${i + 1}: "${variantQuery}"`);
          
          const variantResults = await qdrantService.searchSimilar(variantEmbedding, perVariantTopK, 0.5);
          allResults.push(...variantResults);
        }
        
        // Deduplicate and sort by score
        const seenIds = new Set<string>();
        searchResults = allResults
          .filter(r => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);
        
        console.log(`[Chat] Multi-variant search: ${allResults.length} → ${searchResults.length} unique results`);
      } else {
        // Step 2: Standard search with primary embedding
        searchResults = await qdrantService.searchSimilar(questionEmbedding, topK, 0.5);
      }

      // Apply smart post-filtering based on query intent
      if (isDepositQuery && !isLoanQuery) {
        console.log(`[Chat] 🏦 DEPOSIT query detected - Filtering out loan documents`);
        searchResults = searchResults.filter((result: any) => {
          const docNameLower = result.payload.documentName.toLowerCase();
          const hasLoanKeyword = ['cho vay', 'vay vốn', 'tín dụng'].some(kw => docNameLower.includes(kw));
          return !hasLoanKeyword; // Exclude loan documents
        });
        console.log(`[Chat]    After filtering: ${searchResults.length} results remain`);
      } else if (isLoanQuery && !isDepositQuery) {
        console.log(`[Chat] 💰 LOAN query detected - Filtering out deposit documents`);
        searchResults = searchResults.filter((result: any) => {
          const docNameLower = result.payload.documentName.toLowerCase();
          const hasDepositKeyword = ['tiền gửi', 'gửi tiền'].some(kw => docNameLower.includes(kw));
          return !hasDepositKeyword; // Exclude deposit documents
        });
        console.log(`[Chat]    After filtering: ${searchResults.length} results remain`);
      }

      // Log original search results
      console.log(`\n[Chat DEBUG] Original Qdrant Search Results (Top 5):`);
      searchResults.slice(0, 5).forEach((result: any, idx: number) => {
        console.log(`  ${idx + 1}. Score: ${result.score.toFixed(4)}`);
        console.log(`     Document: ${result.payload.documentName}`);
        console.log(`     Article: ${result.payload.articleNumber || 'N/A'}`);
        console.log(`     Preview: ${result.payload.content}`);
      });

      // Apply reranking for better diversity and relevance
      searchResults = qdrantService.rerankResults(searchResults, question, {
        keywordWeight: 0.1, // Small bonus for keyword matches
        maxPerDocument: 5,
      });

      // Log reranked results
      console.log(`\n[Chat DEBUG] After Reranking (Top 5):`);
      searchResults.slice(0, 5).forEach((result: any, idx: number) => {
        const docNameMatch = queryKeywords.some((kw: string) =>
          result.payload.documentName.toLowerCase().includes(kw)
        );
        console.log(`  ${idx + 1}. Score: ${result.score.toFixed(4)} ${docNameMatch ? '✓ [Doc Name Match]' : ''}`);
        console.log(`     Document: ${result.payload.documentName}`);
        console.log(`     Article: ${result.payload.articleNumber || 'N/A'}`);
        console.log(`     Preview: ${result.payload.content.substring(0, 100)}...`);
      });

      // Take top 10 after reranking
      searchResults = searchResults.slice(0, 10);

      console.log(`[Chat] Found ${searchResults.length} relevant chunks after reranking`);

      if (searchResults.length === 0) {
        return res.json({
          success: true,
          answer: 'Xin lỗi, tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn trong cơ sở dữ liệu văn bản hiện có.',
          sources: [],
          model: 'N/A',
          confidence: 0,
          tokenUsage: { input: 0, output: 0, total: 0 },
        });
      }

      // Step 3: Prepare retrieved chunks
      retrievedChunks = searchResults.map((result) => ({
        chunkId: result.id,
        content: result.payload.content,
        documentId: result.payload.documentId,
        documentName: result.payload.documentName,
        documentNumber: result.payload.documentNumber,
        score: result.score,
        metadata: {
          documentId: result.payload.documentId,
          documentNumber: result.payload.documentNumber,
          documentName: result.payload.documentName,
          documentType: result.payload.documentType,
          chapterNumber: result.payload.chapterNumber,
          chapterTitle: result.payload.chapterTitle,
          articleNumber: result.payload.articleNumber,
          articleTitle: result.payload.articleTitle,
          sectionNumber: result.payload.sectionNumber,
          chunkType: result.payload.chunkType,
          chunkIndex: result.payload.chunkIndex,
        },
      }));
    }

    // Step 4: Generate answer using RAG
    const query: RAGQuery = {
      question: documentFilterMatch ? question.replace(documentFilterMatch[0], '').trim() : question,
      topK: retrievedChunks.length,
    };

    const ragResponse: RAGResponse = await geminiRAGService.generateRAGAnswer(
      query,
      retrievedChunks
    );

    // Step 5: Save chat message to database
    const chatMessage = await prismaAny.chatMessage.create({
      data: {
        userId,
        userMessage: question,
        botResponse: ragResponse.answer,
        retrievedChunks: JSON.stringify(ragResponse.sources || []),
        modelUsed: ragResponse.model || null,
        inputTokens: ragResponse.tokenUsage?.input || 0,
        outputTokens: ragResponse.tokenUsage?.output || 0,
        totalTokens: ragResponse.tokenUsage?.total || 0,
        confidence: ragResponse.confidence || 0,
        cacheHit: false,
        isDeepSearch: false,
      },
    });

    // Cache the response for future use (if high quality and not complex query)
    if (!needsFullDocument && ragResponse.confidence >= 70) {
      await chatCacheService.setCachedResponse(question, ragResponse);
    }

    // Deduct quota if not admin and not subscription user
    if (!hasUnlimitedAccess) {
      await (prisma as any).user.update({
        where: { id: userId },
        data: { aiSearchQuota: { decrement: 1 } }
      });
      console.log(`[Chat] Deducted 1 quota from user ${userId}, remaining: ${user.aiSearchQuota - 1}`);
    }

    console.log(`[Chat] Answer generated, confidence: ${ragResponse.confidence}%`);

    res.json({
      success: true,
      message: {
        id: chatMessage.id,
        userId: chatMessage.userId,
        question: chatMessage.userMessage,
        answer: chatMessage.botResponse,
        sources: JSON.parse(chatMessage.retrievedChunks || '[]'),
        confidence: ragResponse.confidence,
        createdAt: chatMessage.createdAt.toISOString(),
        quotaUsed: !hasUnlimitedAccess,
        remainingQuota: hasUnlimitedAccess ? null : user.aiSearchQuota - 1
      },
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi khi xử lý câu hỏi',
    });
  }
});

/**
 * GET /api/chat/history
 * Get user's chat history
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await prismaAny.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prismaAny.chatMessage.count({
      where: { userId },
    });

    res.json({
      messages: messages.map((msg: any) => ({
        id: msg.id,
        userId: msg.userId,
        question: msg.userMessage,
        answer: msg.botResponse,
        sources: JSON.parse(msg.retrievedChunks || '[]'),
        createdAt: msg.createdAt.toISOString(),
      })),
      total,
    });
  } catch (error) {
    console.error('[Chat] Get history error:', error);
    res.status(500).json({
      error: 'Lỗi khi lấy lịch sử',
    });
  }
});

/**
 * DELETE /api/chat/history/:id
 * Delete a chat message
 */
router.delete('/history/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const message = await prismaAny.chatMessage.findUnique({
      where: { id },
    });

    if (!message || message.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tin nhắn',
      });
    }

    await prismaAny.chatMessage.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Đã xóa tin nhắn',
    });
  } catch (error) {
    console.error('[Chat] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi khi xóa tin nhắn',
    });
  }
});

/**
 * GET /api/chat/stats
 * Get user's chat statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const totalMessages = await prismaAny.chatMessage.count({
      where: { userId },
    });

    const tokenStats = await prismaAny.chatMessage.aggregate({
      where: { userId },
      _sum: {
        totalTokens: true,
      },
    });

    res.json({
      totalMessages,
      totalTokensUsed: tokenStats._sum?.totalTokens || 0,
      averageConfidence: 0, // Not stored in DB, placeholder
    });
  } catch (error) {
    console.error('[Chat] Get stats error:', error);
    res.status(500).json({
      error: 'Lỗi khi lấy thống kê',
    });
  }
});

/**
 * GET /api/chat/documents
 * Get list of documents for file selection
 */
router.get('/documents', requireAuth, async (req: Request, res: Response) => {
  try {
    const documents = await (prisma as any).document.findMany({
      where: {
        processingStatus: 'completed', // Only show processed documents
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        documentName: true,
        documentNumber: true,
        documentType: true,
      },
    });

    res.json({
      documents: documents.map((doc: any) => ({
        id: doc.id,
        fileName: doc.fileName,
        documentName: doc.documentName || doc.fileName,
        documentNumber: doc.documentNumber || '',
        documentType: doc.documentType || '',
      })),
    });
  } catch (error) {
    console.error('[Chat] Get documents error:', error);
    res.status(500).json({
      error: 'Lỗi khi lấy danh sách tài liệu',
    });
  }
});

/**
 * POST /api/chat/deep-search
 * Deep search for more comprehensive answers when user is not satisfied
 */
router.post('/deep-search', requireAuth, requireChatAccess, async (req: Request, res: Response) => {
  try {
    const { originalQuestion, messageId } = req.body;
    const userId = (req as any).user?.id;

    if (!originalQuestion || typeof originalQuestion !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Original question is required',
      });
    }

    if (!messageId || typeof messageId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Message ID is required',
      });
    }

    console.log(`[Deep Search] User ${userId} requesting deep search for: "${originalQuestion.substring(0, 50)}..."`);

    // Check if user has quota (admin has unlimited)
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        aiSearchQuota: true,
        subscriptions: {
          where: { status: 'active' },
          select: {
            status: true,
            plan: true
          }
        }
      }
    });

    // Admin users have unlimited quota
    const isAdmin = user?.role === 'admin';
    const hasActiveSubscription = user?.subscriptions && user.subscriptions.length > 0;
    const hasUnlimitedAccess = isAdmin || hasActiveSubscription;

    if (!user || (!hasUnlimitedAccess && user.aiSearchQuota <= 0)) {
      return res.status(402).json({
        success: false,
        error: 'Không đủ lượt tìm kiếm để sử dụng tìm hiểu sâu hơn. Vui lòng nâng cấp tài khoản.',
        requiresPremium: true
      });
    }

    // Deduct quota if not admin and not subscription user
    if (!hasUnlimitedAccess) {
      await (prisma as any).user.update({
        where: { id: userId },
        data: { aiSearchQuota: { decrement: 1 } }
      });
      console.log(`[Deep Search] Deducted 1 quota from user ${userId}, remaining: ${user.aiSearchQuota - 1}`);
    }    // Enhanced search parameters for deep search
    const questionEmbedding = await geminiRAGService.generateEmbedding(originalQuestion);

    // Use higher topK and lower minScore for more comprehensive search
    const searchResults = await qdrantService.searchSimilar(questionEmbedding, 25, 0.3);

    console.log(`[Deep Search] Found ${searchResults.length} chunks with expanded criteria`);

    if (searchResults.length === 0) {
      return res.json({
        success: true,
        answer: 'Xin lỗi, ngay cả với tìm kiếm mở rộng tôi vẫn không tìm thấy thông tin liên quan đến câu hỏi của bạn.',
        sources: [],
        model: 'N/A',
        confidence: 0,
        tokenUsage: { input: 0, output: 0, total: 0 },
        isDeepSearch: true
      });
    }

    // Prepare retrieved chunks
    const retrievedChunks = searchResults.map((result) => ({
      chunkId: result.id,
      content: result.payload.content,
      documentId: result.payload.documentId,
      documentName: result.payload.documentName,
      documentNumber: result.payload.documentNumber,
      score: result.score,
      metadata: {
        documentId: result.payload.documentId,
        documentNumber: result.payload.documentNumber,
        documentName: result.payload.documentName,
        documentType: result.payload.documentType,
        chapterNumber: result.payload.chapterNumber,
        chapterTitle: result.payload.chapterTitle,
        articleNumber: result.payload.articleNumber,
        articleTitle: result.payload.articleTitle,
        sectionNumber: result.payload.sectionNumber,
        chunkType: result.payload.chunkType,
        chunkIndex: result.payload.chunkIndex,
      },
    }));

    // Generate comprehensive answer
    const query: RAGQuery = {
      question: originalQuestion,
      topK: 25, // Use more chunks for deep search
    };

    const ragResponse: RAGResponse = await geminiRAGService.generateRAGAnswer(
      query,
      retrievedChunks
    );

    // Save as new chat message with deep search flag
    const chatMessage = await prismaAny.chatMessage.create({
      data: {
        userId,
        userMessage: `[Deep Search] ${originalQuestion}`,
        botResponse: ragResponse.answer,
        retrievedChunks: JSON.stringify(ragResponse.sources || []),
        modelUsed: `${ragResponse.model} (deep search)`,
        inputTokens: ragResponse.tokenUsage?.input || 0,
        outputTokens: ragResponse.tokenUsage?.output || 0,
        totalTokens: ragResponse.tokenUsage?.total || 0,
        confidence: ragResponse.confidence || 0,
        cacheHit: false,
        isDeepSearch: true,
      },
    });

    console.log(`[Deep Search] Generated comprehensive answer, confidence: ${ragResponse.confidence}%`);

    res.json({
      success: true,
      message: {
        id: chatMessage.id,
        userId: chatMessage.userId,
        question: originalQuestion,
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        confidence: ragResponse.confidence,
        createdAt: chatMessage.createdAt.toISOString(),
        isDeepSearch: true,
        quotaUsed: !hasUnlimitedAccess,
        remainingQuota: hasUnlimitedAccess ? null : user.aiSearchQuota - 1
      },
    });
  } catch (error) {
    console.error('[Deep Search] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi khi thực hiện tìm kiếm sâu',
    });
  }
});

/**
 * GET /api/chat/cache/stats
 * Get cache statistics (Admin only)
 */
router.get('/cache/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check admin permission (basic check)
    const user = await (prisma as any).user.findUnique({
      where: { id: (req as any).user?.id },
      select: { email: true }
    });

    // Simple admin check - you can improve this
    if (!user?.email.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const stats = chatCacheService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Cache Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

/**
 * POST /api/chat/cache/clear
 * Clear cache (Admin only)
 */
router.post('/cache/clear', requireAuth, async (req: Request, res: Response) => {
  try {
    // Check admin permission
    const user = await (prisma as any).user.findUnique({
      where: { id: (req as any).user?.id },
      select: { email: true }
    });

    if (!user?.email.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    chatCacheService.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('[Cache Clear] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

export default router;
