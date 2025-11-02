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
 * POST /api/chat/ask-stream
 * Ask a question using RAG with streaming response
 */
router.post('/ask-stream', requireAuth, async (req: Request, res: Response) => {
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
      // Check if question requires full document analysis
      const analysisKeywords = [
        'bao nhiêu', 'có bao nhiêu', 'số lượng', 'đếm',
        'tính tổng', 'tổng cộng', 'tổng số', 'cộng lại',
        'tóm tắt', 'tổng hợp', 'liệt kê tất cả', 'liệt kê toàn bộ',
        'danh sách đầy đủ', 'toàn bộ', 'tất cả các'
      ];

      const questionLower = question.toLowerCase();
      const needsFullDocument = analysisKeywords.some(keyword => questionLower.includes(keyword));

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
        console.log(`[Chat Stream] Query analysis:`, queryAnalysis);

        sendEvent('status', { 
          message: `Tìm kiếm trong: ${queryAnalysis.collections.join(', ')}...` 
        });

        // Generate embedding for question
        const questionEmbedding = await geminiRAGService.generateEmbedding(question);

        // Extract keywords for debugging
        const queryKeywords = question.toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 2);
        console.log(`[Chat Stream] Query keywords:`, queryKeywords);

        // NEW: Search across multiple collections (if analysis determined multiple)
        let searchResults;
        if (queryAnalysis.collections.length > 1) {
          console.log(`[Chat Stream] Searching in multiple collections:`, queryAnalysis.collections);
          searchResults = await qdrantService.searchMultipleCollections(
            questionEmbedding, 
            queryAnalysis.collections,
            { topK: 30, minScore: 0.5 }
          );
        } else {
          console.log(`[Chat Stream] Searching in single collection:`, queryAnalysis.collections[0]);
          searchResults = await qdrantService.search(
            questionEmbedding,
            { 
              topK: 30, 
              minScore: 0.5,
              collectionName: queryAnalysis.collections[0]
            }
          );
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
        },
      });

      // Send completion event
      sendEvent('complete', {
        messageId: chatMessage.id,
        confidence: streamMetadata?.confidence || 0,
        sources: streamMetadata?.sources || [],
        model: streamMetadata?.model || 'N/A',
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
router.post('/ask', requireAuth, async (req: Request, res: Response) => {
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

    // Check if question requires full document analysis
    const analysisKeywords = [
      'bao nhiêu', 'có bao nhiêu', 'số lượng', 'đếm',
      'tính tổng', 'tổng cộng', 'tổng số', 'cộng lại',
      'tóm tắt', 'tổng hợp', 'liệt kê tất cả', 'liệt kê toàn bộ',
      'danh sách đầy đủ', 'toàn bộ', 'tất cả các'
    ];

    const questionLower = question.toLowerCase();
    const needsFullDocument = analysisKeywords.some(keyword => questionLower.includes(keyword));

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
      // Step 1: Generate embedding for question
      const questionEmbedding = await geminiRAGService.generateEmbedding(question);

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

      // Step 2: Search similar chunks in Qdrant (increased to 30 for post-filtering)
      searchResults = await qdrantService.searchSimilar(questionEmbedding, 30, 0.5);

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
      },
    });

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

export default router;
