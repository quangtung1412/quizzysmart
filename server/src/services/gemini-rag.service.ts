/**
 * Gemini RAG Service
 * 
 * Handles PDF extraction, embedding, and answer generation using Google Gemini AI
 */

import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import type {
  DocumentContent,
  DocumentMetadata,
  GeminiExtractionResponse,
  GeminiEmbeddingResponse,
  RAGQuery,
  RAGResponse,
  RetrievedChunk,
} from '../types/rag.types.js';
import { geminiModelRotation } from '../gemini-model-rotation.js';
import { qdrantService } from './qdrant.service.js';
import { modelSettingsService } from './model-settings.service.js';
import { geminiTrackerService } from './gemini-tracker.service.js';

class GeminiRAGService {
  private ai: GoogleGenAI;
  private maxRetries = 3;
  private retryDelay = 2000; // Start with 2 seconds

  constructor(apiKey?: string) {
    // Allow custom API key, default to GEMINI_API_KEY
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }

    this.ai = new GoogleGenAI({ apiKey: key });
  }

  /**
   * Get appropriate model for answering (respects model rotation settings)
   */
  private async getAnswerModel(): Promise<{ name: string; priority: number }> {
    // Try to get system settings to check if rotation is enabled
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const systemSettings = await (prisma as any).systemSettings.findFirst();
      await prisma.$disconnect();

      if (systemSettings && !systemSettings.modelRotationEnabled) {
        // Model rotation is disabled - use default model from model settings
        const defaultModel = await modelSettingsService.getDefaultModel();
        console.log(`[Gemini] Model rotation DISABLED - Using default model: ${defaultModel}`);
        return { name: defaultModel, priority: 0 };
      }
    } catch (error) {
      console.warn('[Gemini] Could not check system settings, using rotation:', error);
    }

    // Model rotation is enabled - use rotation
    const modelInfo = await geminiModelRotation.getNextAvailableModel();
    if (!modelInfo) {
      throw new Error('No available Gemini models');
    }
    console.log(`[Gemini] Model rotation ENABLED - Using: ${modelInfo.name}`);
    return modelInfo;
  }

  /**
   * Sleep utility for retry delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable (503, 429, network errors)
   */
  private isRetryableError(error: any): boolean {
    const errorStr = error.toString().toLowerCase();
    return (
      errorStr.includes('503') ||
      errorStr.includes('overloaded') ||
      errorStr.includes('429') ||
      errorStr.includes('quota') ||
      errorStr.includes('rate limit') ||
      errorStr.includes('unavailable')
    );
  }

  /**
   * Upload PDF to Gemini File API
   */
  async uploadPDF(filePath: string, displayName: string): Promise<string> {
    try {
      console.log(`[Gemini] Uploading PDF to File API: ${displayName}`);

      // Read file as buffer
      const fs = await import('fs');
      const fileBuffer = await fs.promises.readFile(filePath);
      const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });

      const file = await this.ai.files.upload({
        file: fileBlob,
        config: {
          displayName: displayName,
        },
      });

      console.log(`[Gemini] PDF uploaded successfully. URI: ${file.uri}`);

      if (!file.uri) {
        throw new Error('File URI is undefined');
      }

      return file.uri;
    } catch (error) {
      console.error('[Gemini] PDF upload failed:', error);
      throw new Error(`Failed to upload PDF: ${error}`);
    }
  }

  /**
   * Extract structured content from PDF using Gemini
   */
  async extractDocumentContent(fileUri: string): Promise<GeminiExtractionResponse> {
    try {
      console.log(`[Gemini] Extracting content from: ${fileUri}`);

      // Wait for file to be processed (if it's a fresh upload)
      const fileName = fileUri.split('/').pop()!;
      let fileInfo = await this.ai.files.get({ name: fileName });
      console.log(`[Gemini] File state: ${fileInfo.state}`);

      while (fileInfo.state === 'PROCESSING') {
        console.log('[Gemini] File is still processing, waiting 5 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        fileInfo = await this.ai.files.get({ name: fileName });
      }

      if (fileInfo.state === 'FAILED') {
        throw new Error('File processing failed');
      }

      console.log(`[Gemini] File ready, state: ${fileInfo.state}`);

      const prompt = `
Bạn là một chuyên gia phân tích văn bản pháp luật Việt Nam. Nhiệm vụ của bạn là trích xuất CHÍNH XÁC và ĐẦY ĐỦ toàn bộ nội dung từ văn bản PDF.

YÊU CẦU QUAN TRỌNG:
1. Trích xuất TOÀN BỘ văn bản, không được bỏ sót bất kỳ phần nào
2. Giữ nguyên cấu trúc phân cấp: Chương → Điều → Khoản → Điểm
3. Trả về JSON với cấu trúc chuẩn như bên dưới
4. Nội dung phải được format theo Markdown để dễ đọc
5. Các số điều, khoản phải chính xác
6. JSON PHẢI HOÀN TOÀN HỢP LỆ:
   - KHÔNG có trailing commas (dấu phẩy thừa trước }, ])
   - Tất cả strings phải được escape đúng (\n cho newline, \" cho quotes)
   - KHÔNG có control characters
   - Mỗi phần tử trong array phải có dấu phẩy ngăn cách (trừ phần tử cuối)
   - Tất cả {} và [] phải đóng mở đúng cặp

Cấu trúc JSON yêu cầu:
{
  "overview": {
    "documentNumber": "Số văn bản (ví dụ: 01/2024/TT-NHNN)",
    "documentName": "Tên đầy đủ văn bản",
    "documentType": "Loại văn bản (Thông tư/Nghị định/Quyết định/...)",
    "issuingAgency": "Cơ quan ban hành",
    "signer": {
      "name": "Tên người ký",
      "title": "Chức danh"
    },
    "signedDate": "Ngày ký (format: YYYY-MM-DD)"
  },
  "basis": [
    {
      "type": "Loại căn cứ (Luật/Nghị định/...)",
      "number": "Số văn bản căn cứ",
      "name": "Tên văn bản căn cứ",
      "date": "Ngày ban hành (nếu có)"
    }
  ],
  "chapters": [
    {
      "number": "Số chương (I, II, III hoặc 1, 2, 3)",
      "title": "Tên chương",
      "articles": [
        {
          "number": "Số điều",
          "title": "Tên điều (nếu có)",
          "content": "Nội dung điều (nếu không có khoản)",
          "sections": [
            {
              "number": "Số khoản (1, 2, 3 hoặc a, b, c)",
              "content": "Nội dung khoản (Markdown format)",
              "subsections": [
                "Điểm a: nội dung",
                "Điểm b: nội dung"
              ]
            }
          ]
        }
      ]
    }
  ],
  "articles": [
    // Dùng khi văn bản KHÔNG có chương, chỉ có điều
    {
      "number": "Số điều",
      "title": "Tên điều",
      "sections": [...]
    }
  ],
  "appendices": [
    {
      "number": "Số phụ lục",
      "title": "Tên phụ lục",
      "content": "Nội dung phụ lục (Markdown)"
    }
  ]
}

QUAN TRỌNG:
- Nếu văn bản có chương, sử dụng trường "chapters"
- Nếu văn bản KHÔNG có chương, sử dụng trường "articles" trực tiếp
- Mỗi điều phải có đầy đủ các khoản (nếu có)
- Format nội dung theo Markdown: dùng **bold**, *italic*, bullet points khi cần
- Giữ nguyên số thứ tự điều, khoản, điểm
- QUAN TRỌNG NHẤT: Đảm bảo JSON output hoàn toàn hợp lệ, không có trailing commas, escape đúng các special characters trong strings

Hãy phân tích văn bản PDF và trả về ONLY JSON theo đúng cấu trúc trên, không thêm text giải thích.
`;

      // Create content with file URI part
      const contents: any[] = [prompt];

      if (fileInfo.uri && fileInfo.mimeType) {
        contents.push(createPartFromUri(fileInfo.uri, fileInfo.mimeType));
      }

      // Use gemini-2.5-flash for extraction with retry logic
      let lastError: any;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`[Gemini] Extraction attempt ${attempt}/${this.maxRetries}`);

          const trackingId = await geminiTrackerService.startTracking({
            endpoint: 'generateContent',
            modelName: 'gemini-2.5-flash',
            requestType: 'document_extraction',
            metadata: { fileUri },
          });

          const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
          });

          const text = response.text || '';
          const usageMetadata: any = (response as any).usageMetadata || {};
          const inputTokens = usageMetadata.promptTokenCount || 0;
          const outputTokens = usageMetadata.candidatesTokenCount || 0;

          await geminiTrackerService.endTracking(trackingId, {
            inputTokens,
            outputTokens,
            status: 'success',
          });

          console.log(`[Gemini] Extraction completed successfully`);

          // Parse JSON response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Gemini response');
          }

          let documentContent: DocumentContent;
          try {
            // Try to parse JSON directly
            documentContent = JSON.parse(jsonMatch[0]);
          } catch (parseError: any) {
            console.warn(`[Gemini] Initial JSON parse failed: ${parseError.message}`);
            console.log(`[Gemini] Attempting to clean and fix JSON...`);

            // Advanced JSON cleaning and fixing
            let cleanedJson = jsonMatch[0];

            // Step 1: Remove trailing commas (most common issue)
            cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');

            // Step 2: Fix line breaks in strings (replace actual newlines with \n)
            cleanedJson = cleanedJson.replace(/"([^"]*)"(\s*:\s*"[^"]*\n[^"]*")/g, (match, key, value) => {
              return `"${key}"${value.replace(/\n/g, '\\n')}`;
            });

            // Step 3: Remove control characters except newline, tab, carriage return
            cleanedJson = cleanedJson.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

            // Step 4: Fix unescaped quotes within strings (complex regex)
            // This tries to find quotes that are not properly escaped
            try {
              const lines = cleanedJson.split('\n');
              const fixedLines = lines.map(line => {
                // If line contains a string value, ensure quotes inside are escaped
                if (line.includes('": "') || line.includes('":"')) {
                  // Match pattern: "key": "value with potential unescaped quotes"
                  return line.replace(/:\s*"([^"]*)"([^",\]}]*)"([^"]*)"(\s*[,\]}])/g, (match, p1, p2, p3, p4) => {
                    // If middle part doesn't start with comma/bracket, it's likely an unescaped quote
                    if (p2.trim() && !p2.trim().startsWith(',') && !p2.trim().startsWith('}') && !p2.trim().startsWith(']')) {
                      return `: "${p1}\\"${p2}\\"${p3}"${p4}`;
                    }
                    return match;
                  });
                }
                return line;
              });
              cleanedJson = fixedLines.join('\n');
            } catch (e) {
              console.warn('[Gemini] Could not apply advanced quote fixing');
            }

            try {
              documentContent = JSON.parse(cleanedJson);
              console.log(`[Gemini] JSON successfully cleaned and parsed`);
            } catch (secondError: any) {
              console.error(`[Gemini] Failed to parse JSON after manual cleaning: ${secondError.message}`);

              // Last resort: Use jsonrepair library
              try {
                console.log('[Gemini] Attempting to repair JSON using jsonrepair library...');
                const repairedJson = jsonrepair(cleanedJson);
                documentContent = JSON.parse(repairedJson);
                console.log('[Gemini] ✅ JSON successfully repaired and parsed using jsonrepair!');
              } catch (repairError: any) {
                console.error(`[Gemini] ❌ jsonrepair also failed: ${repairError.message}`);

                // Extract position from error message for debugging
                const posMatch = secondError.message.match(/position (\d+)/);
                if (posMatch) {
                  const errorPos = parseInt(posMatch[1]);
                  const start = Math.max(0, errorPos - 200);
                  const end = Math.min(cleanedJson.length, errorPos + 200);
                  console.error(`[Gemini] JSON excerpt near error position ${errorPos}:`);
                  console.error(cleanedJson.substring(start, end));
                  console.error(' '.repeat(Math.min(200, errorPos - start)) + '^--- ERROR HERE');
                }

                throw new Error(`Failed to parse JSON from Gemini response: ${secondError.message}`);
              }
            }
          }

          return {
            content: documentContent,
            rawText: text,
          };
        } catch (error) {
          lastError = error;

          if (this.isRetryableError(error)) {
            if (attempt < this.maxRetries) {
              const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
              console.warn(`[Gemini] Retryable error (attempt ${attempt}/${this.maxRetries}): ${error}`);
              console.log(`[Gemini] Waiting ${delay}ms before retry...`);
              await this.sleep(delay);
              continue;
            } else {
              console.error(`[Gemini] Max retries reached. Last error: ${error}`);
            }
          } else {
            // Non-retryable error, fail immediately
            console.error(`[Gemini] Non-retryable error: ${error}`);
            break;
          }
        }
      }

      // If we get here, all retries failed
      throw lastError;
    } catch (error) {
      console.error('[Gemini] Content extraction failed:', error);
      throw new Error(`Failed to extract document content: ${error}`);
    }
  }

  /**
   * Generate embedding for text with retry logic
   */
  async generateEmbedding(text: string, sessionId?: string, userId?: string): Promise<number[]> {
    let lastError: any;

    // Get embedding model from settings
    const embeddingModel = await modelSettingsService.getEmbeddingModel();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const trackingId = await geminiTrackerService.startTracking({
          endpoint: 'embedContent',
          modelName: embeddingModel,
          requestType: 'embedding',
          userId,
          sessionId,
          metadata: { textLength: text.length },
        });

        const result = await this.ai.models.embedContent({
          model: embeddingModel,
          contents: text,
          config: {
            outputDimensionality: 768  // Force 768 dimensions for compatibility
          }
        });

        if (!result.embeddings || result.embeddings.length === 0 || !result.embeddings[0].values) {
          throw new Error('Invalid embedding response');
        }

        // Estimate tokens for embedding (rough estimate: 1 token ≈ 4 characters)
        const estimatedTokens = Math.ceil(text.length / 4);
        await geminiTrackerService.endTracking(trackingId, {
          inputTokens: estimatedTokens,
          outputTokens: 0,
          status: 'success',
        });

        return result.embeddings[0].values;
      } catch (error) {
        lastError = error;

        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[Gemini] Embedding retry ${attempt}/${this.maxRetries}: ${error}`);
          console.log(`[Gemini] Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
          continue;
        }
      }
    }

    console.error('[Gemini] Embedding generation failed:', lastError);
    throw new Error(`Failed to generate embedding: ${lastError}`);
  }

  /**
   * Generate embeddings for multiple texts (batch)
   * Optimized to send multiple texts in a single API call to reduce costs
   */
  async generateEmbeddings(texts: string[], sessionId?: string, userId?: string): Promise<number[][]> {
    try {
      const startTime = Date.now();
      console.log(`[Gemini] 🚀 Generating embeddings for ${texts.length} texts using batch mode`);

      if (texts.length === 0) {
        return [];
      }

      // Get embedding model from settings
      const embeddingModel = await modelSettingsService.getEmbeddingModel();

      const allEmbeddings: number[][] = [];

      // Process in batches to avoid hitting API limits
      // Gemini API supports multiple contents in one request
      const batchSize = 100; // Increased from 10 since we're now using single API call per batch
      const totalBatches = Math.ceil(texts.length / batchSize);

      console.log(`[Gemini] 💰 Cost Optimization: Using ${totalBatches} API call(s) instead of ${texts.length} calls (${Math.round((1 - totalBatches / texts.length) * 100)}% reduction)`);

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        console.log(`[Gemini] Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)`);

        let lastError: any;
        let batchEmbeddings: number[][] | null = null;

        // Retry logic for the entire batch
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
          try {
            const trackingId = await geminiTrackerService.startTracking({
              endpoint: 'embedContent',
              modelName: embeddingModel,
              requestType: 'embedding',
              userId,
              sessionId,
              metadata: { batchSize: batch.length, batchNum, totalBatches },
            });

            // Send all texts in the batch as an array to embedContent
            const result = await this.ai.models.embedContent({
              model: embeddingModel,
              contents: batch, // Send array of texts
              config: {
                outputDimensionality: 768  // Force 768 dimensions for compatibility
              }
            });

            if (!result.embeddings || result.embeddings.length !== batch.length) {
              throw new Error(`Invalid embedding response: expected ${batch.length} embeddings, got ${result.embeddings?.length || 0}`);
            }

            // Extract all embedding vectors
            batchEmbeddings = result.embeddings.map((emb: any) => {
              if (!emb.values) {
                throw new Error('Embedding response missing values');
              }
              return emb.values;
            });

            // Estimate tokens (rough: 1 token ≈ 4 chars, sum all texts)
            const totalChars = batch.reduce((sum, t) => sum + t.length, 0);
            const estimatedTokens = Math.ceil(totalChars / 4);

            await geminiTrackerService.endTracking(trackingId, {
              inputTokens: estimatedTokens,
              outputTokens: 0,
              status: 'success',
            });

            console.log(`[Gemini] ✅ Batch ${batchNum}/${totalBatches}: Successfully generated ${batchEmbeddings.length} embeddings`);
            break; // Success, exit retry loop
          } catch (error) {
            lastError = error;

            if (this.isRetryableError(error) && attempt < this.maxRetries) {
              const delay = this.retryDelay * Math.pow(2, attempt - 1);
              console.warn(`[Gemini] Batch ${batchNum} retry ${attempt}/${this.maxRetries}: ${error}`);
              console.log(`[Gemini] Waiting ${delay}ms before retry...`);
              await this.sleep(delay);
              continue;
            } else {
              console.error(`[Gemini] Batch ${batchNum} failed after ${attempt} attempts`);
              break;
            }
          }
        }

        if (!batchEmbeddings) {
          console.error(`[Gemini] ⚠️ Batch ${batchNum} failed, falling back to individual requests`);
          // Fallback: Process texts individually if batch fails
          const fallbackResults: number[][] = [];
          for (const text of batch) {
            try {
              const embedding = await this.generateEmbedding(text, sessionId, userId);
              fallbackResults.push(embedding);
            } catch (error) {
              console.error(`[Gemini] Failed to generate embedding for individual text: ${error}`);
              throw error;
            }
          }
          batchEmbeddings = fallbackResults;
        }

        allEmbeddings.push(...batchEmbeddings);

        // Small delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Gemini] ✅ Completed: ${allEmbeddings.length} embeddings generated in ${duration}s (avg: ${(parseFloat(duration) / allEmbeddings.length * 1000).toFixed(0)}ms per embedding)`);
      return allEmbeddings;
    } catch (error) {
      console.error('[Gemini] Batch embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate answer using RAG (Retrieval-Augmented Generation)
   */
  async generateRAGAnswer(
    query: RAGQuery,
    retrievedChunks: RetrievedChunk[],
    sessionId?: string,
    userId?: string
  ): Promise<RAGResponse> {
    try {
      console.log(`[Gemini] Generating RAG answer for query: "${query.question.substring(0, 50)}..."`);

      // Apply intelligent filtering (Phase 2 optimization)
      const maxChunks = query.topK || 12;
      const filteredChunks = this.filterChunksByRelevance(retrievedChunks, maxChunks, 0.5);

      // Build context from filtered chunks
      const context = filteredChunks
        .map((chunk, idx) => {
          const source = chunk.documentNumber
            ? `${chunk.documentName} (${chunk.documentNumber})`
            : chunk.documentName;

          let location = '';
          if (chunk.metadata.chapterNumber) {
            location += `Chương ${chunk.metadata.chapterNumber}`;
          }
          if (chunk.metadata.articleNumber) {
            location += location ? `, Điều ${chunk.metadata.articleNumber}` : `Điều ${chunk.metadata.articleNumber}`;
          }

          return `[${idx + 1}] ${source}${location ? ` - ${location}` : ''}:\n${chunk.content}`;
        })
        .join('\n\n---\n\n');

      console.log(`[Gemini] Context built from ${filteredChunks.length} filtered chunks (was ${retrievedChunks.length})`);

      const prompt = this.buildRAGPrompt(query.question, context, query.format || 'prose');

      const modelInfo = await this.getAnswerModel();

      // Generate answer with retry logic
      let lastError: any;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`[Gemini] RAG answer attempt ${attempt}/${this.maxRetries}`);

          const response = await this.ai.models.generateContent({
            model: modelInfo.name,
            contents: prompt,
          });

          const answer = response.text || '';

          // Get token usage (if available)
          const usageMetadata: any = (response as any).usageMetadata || {};
          const inputTokens = usageMetadata.promptTokenCount || 0;
          const outputTokens = usageMetadata.candidatesTokenCount || 0;
          const totalTokens = usageMetadata.totalTokenCount || inputTokens + outputTokens;

          console.log(`[Gemini] RAG answer generated, tokens: ${totalTokens}`);

          // Parse structured quiz answer if available
          let structuredAnswer: any = null;
          try {
            const jsonMatch = answer.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              structuredAnswer = JSON.parse(jsonMatch[0]);
              console.log('[Gemini] Parsed structured quiz answer:', structuredAnswer);
            }
          } catch (parseError) {
            console.warn('[Gemini] Could not parse structured answer, using raw text');
          }

          // Calculate confidence based on retrieval scores
          const avgScore = filteredChunks.reduce((sum, c) => sum + c.score, 0) / filteredChunks.length;
          const maxScore = Math.max(...filteredChunks.map(c => c.score));
          const minScore = Math.min(...filteredChunks.map(c => c.score));
          const confidence = Math.round(avgScore * 100);

          console.log(`[Gemini] Confidence calculation:`);
          console.log(`  - Avg Score: ${avgScore.toFixed(4)} (${confidence}%)`);
          console.log(`  - Max Score: ${maxScore.toFixed(4)}`);
          console.log(`  - Min Score: ${minScore.toFixed(4)}`);
          console.log(`  - Chunks used: ${filteredChunks.length}`);

          return {
            answer: structuredAnswer || answer,
            sources: filteredChunks, // Return filtered chunks
            model: modelInfo.name,
            confidence: structuredAnswer?.confidence || confidence,
            tokenUsage: {
              input: inputTokens,
              output: outputTokens,
              total: totalTokens,
            },
            structured: !!structuredAnswer
          };
        } catch (error) {
          lastError = error;

          if (this.isRetryableError(error) && attempt < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            console.warn(`[Gemini] RAG answer retry ${attempt}/${this.maxRetries}: ${error}`);
            console.log(`[Gemini] Waiting ${delay}ms before retry...`);
            await this.sleep(delay);
            continue;
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (error) {
      console.error('[Gemini] RAG answer generation failed:', error);
      throw new Error(`Failed to generate answer: ${error}`);
    }
  }

  /**
   * Generate answer using RAG with streaming (with retry logic)
   */
  async *generateRAGAnswerStream(
    query: RAGQuery,
    retrievedChunks: RetrievedChunk[],
    sessionId?: string,
    userId?: string
  ): AsyncGenerator<{ chunk: string; done: boolean; metadata?: any }> {
    console.log(`[Gemini] Generating streaming RAG answer for query: "${query.question.substring(0, 50)}..."`);

    // Apply intelligent filtering (Phase 2 optimization)
    const maxChunks = query.topK || 12;
    const filteredChunks = this.filterChunksByRelevance(retrievedChunks, maxChunks, 0.5);

    // Build context from filtered chunks
    const context = filteredChunks
      .map((chunk, idx) => {
        const source = chunk.documentNumber
          ? `${chunk.documentName} (${chunk.documentNumber})`
          : chunk.documentName;

        let location = '';
        if (chunk.metadata.chapterNumber) {
          location += `Chương ${chunk.metadata.chapterNumber}`;
        }
        if (chunk.metadata.articleNumber) {
          location += location ? `, Điều ${chunk.metadata.articleNumber}` : `Điều ${chunk.metadata.articleNumber}`;
        }

        return `[${idx + 1}] ${source}${location ? ` - ${location}` : ''}:\n${chunk.content}`;
      })
      .join('\n\n---\n\n');

    console.log(`[Gemini] Context built from ${filteredChunks.length} filtered chunks (was ${retrievedChunks.length})`);

    const prompt = this.buildRAGPrompt(query.question, context, query.format || 'prose');

    // Retry logic for streaming
    let lastError: any;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      let trackingId: string | undefined;
      try {
        console.log(`[Gemini] Streaming attempt ${attempt}/${this.maxRetries}`);

        const modelInfo = await this.getAnswerModel();
        console.log(`[Gemini] Streaming with model: ${modelInfo.name}`);

        trackingId = await geminiTrackerService.startTracking({
          endpoint: 'generateContentStream',
          modelName: modelInfo.name,
          modelPriority: modelInfo.priority,
          requestType: 'chat',
          userId,
          sessionId,
          metadata: {
            question: query.question.substring(0, 100),
            chunkCount: filteredChunks.length,
          },
        });

        const streamPromise = this.ai.models.generateContentStream({
          model: modelInfo.name,
          contents: prompt,
        });

        const stream = await streamPromise;

        let fullText = '';
        let tokenCount = 0;

        for await (const chunk of stream) {
          const text = chunk.text || '';
          fullText += text;
          tokenCount += Math.ceil(text.length / 4); // Rough estimate
          yield { chunk: text, done: false };
        }

        // Estimate tokens (rough: prompt + response)
        const estimatedInputTokens = Math.ceil(prompt.length / 4);
        const estimatedOutputTokens = tokenCount;

        await geminiTrackerService.endTracking(trackingId, {
          inputTokens: estimatedInputTokens,
          outputTokens: estimatedOutputTokens,
          status: 'success',
        });

        // Calculate confidence based on retrieval scores
        const avgScore = filteredChunks.reduce((sum, c) => sum + c.score, 0) / filteredChunks.length;
        const confidence = Math.round(avgScore * 100);

        console.log(`[Gemini] Streaming completed, total length: ${fullText.length}`);

        // Parse structured quiz answer if available
        let structuredAnswer: any = null;
        try {
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            structuredAnswer = JSON.parse(jsonMatch[0]);
            console.log('[Gemini] Parsed structured quiz answer (streaming):', structuredAnswer);
          }
        } catch (parseError) {
          console.warn('[Gemini] Could not parse structured answer in streaming, using raw text');
        }

        // Final chunk with metadata (use filtered chunks for sources)
        yield {
          chunk: '',
          done: true,
          metadata: {
            model: modelInfo.name,
            confidence: structuredAnswer?.confidence || confidence,
            sources: filteredChunks,
            answer: structuredAnswer || fullText,
            structured: !!structuredAnswer
          }
        };

        return; // Success, exit retry loop
      } catch (error) {
        lastError = error;

        // Try to end tracking with error status if trackingId exists
        if (typeof trackingId !== 'undefined') {
          try {
            await geminiTrackerService.endTracking(trackingId, {
              inputTokens: 0,
              outputTokens: 0,
              status: 'error',
              errorMessage: String(error).substring(0, 500),
              retryCount: attempt,
            });
          } catch (trackingError) {
            console.warn('[Gemini] Failed to record error tracking:', trackingError);
          }
        }

        if (this.isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`[Gemini] Streaming retry ${attempt}/${this.maxRetries}: ${error}`);
          console.log(`[Gemini] Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
          continue;
        } else {
          // Non-retryable or max retries reached
          console.error(`[Gemini] Streaming failed after ${attempt} attempts:`, error);
          break;
        }
      }
    }

    // All retries failed
    console.error('[Gemini] RAG streaming failed:', lastError);
    throw new Error(`Failed to stream answer: ${lastError}`);
  }

  /**
   * Filter chunks by relevance and remove duplicates (Phase 2 optimization)
   */
  private filterChunksByRelevance(
    chunks: RetrievedChunk[],
    maxChunks: number,
    minScore: number = 0.6
  ): RetrievedChunk[] {
    console.log(`[Gemini] Filtering ${chunks.length} chunks, maxChunks: ${maxChunks}, minScore: ${minScore}`);

    // Step 1: Filter by minimum score
    let filtered = chunks.filter(chunk => chunk.score >= minScore);
    console.log(`[Gemini] After score filter: ${filtered.length} chunks`);

    // Step 2: Group by document and prioritize higher scores within same document
    const byDocument = new Map<string, RetrievedChunk[]>();
    filtered.forEach(chunk => {
      const docKey = chunk.documentNumber || chunk.documentName;
      if (!byDocument.has(docKey)) {
        byDocument.set(docKey, []);
      }
      byDocument.get(docKey)!.push(chunk);
    });

    // Step 3: Sort chunks within each document by score and take top ones
    const maxChunksPerDoc = Math.min(3, Math.ceil(maxChunks / byDocument.size));
    const balanced: RetrievedChunk[] = [];

    for (const [docName, docChunks] of byDocument) {
      const sortedChunks = docChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunksPerDoc);
      balanced.push(...sortedChunks);
      console.log(`[Gemini] Document "${docName}": ${sortedChunks.length}/${docChunks.length} chunks selected`);
    }

    // Step 4: Remove content duplicates using simple similarity
    const deduplicated = this.removeDuplicateContent(balanced);

    // Step 5: Final sort by score and limit to maxChunks
    const final = deduplicated
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks);

    console.log(`[Gemini] Final selection: ${final.length} chunks from ${byDocument.size} documents`);
    return final;
  }

  /**
   * Remove chunks with similar content
   */
  private removeDuplicateContent(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const result: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      let isDuplicate = false;

      for (const existing of result) {
        // Simple content similarity check
        const similarity = this.calculateContentSimilarity(chunk.content, existing.content);
        if (similarity > 0.8) { // 80% similar
          isDuplicate = true;
          // Keep the one with higher score
          if (chunk.score > existing.score) {
            const index = result.indexOf(existing);
            result[index] = chunk;
          }
          break;
        }
      }

      if (!isDuplicate) {
        result.push(chunk);
      }
    }

    console.log(`[Gemini] Deduplication: ${chunks.length} → ${result.length} chunks`);
    return result;
  }

  /**
   * Calculate simple content similarity between two texts
   */
  private calculateContentSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);

    if (norm1 === norm2) return 1.0;

    // Simple word-based similarity
    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Build RAG prompt (optimized version)
   */
  private buildRAGPrompt(question: string, context: string, format: 'json' | 'prose' = 'prose'): string {
    // Check if it's a multiple choice question
    const isMultipleChoiceQuestion = this.isMultipleChoiceQuestion(question);

    // Only use JSON format if explicitly requested AND it's a multiple choice question
    if (format === 'json' && isMultipleChoiceQuestion) {
      // Multiple choice question - return specific answer format
      const hasExtractedOptions = question.includes('Các đáp án:');

      if (hasExtractedOptions) {
        // Image-based question with extracted options
        return `
Bạn là trợ lý AI chuyên nghiệp vụ ngân hàng. Dựa trên các văn bản quy định được cung cấp, hãy phân tích và chọn đáp án đúng.

NGUYÊN TẮC:
1. Phân tích câu hỏi và các đáp án được cung cấp từ hình ảnh
2. Dựa trên tài liệu để xác định đáp án CHÍNH XÁC nhất
3. Trả về chỉ chữ cái đáp án đúng (A, B, C, hoặc D)
4. Đưa ra nguồn văn bản cụ thể (điều, khoản)
5. Trả về dưới dạng JSON với format:

{
  "correctAnswer": "A|B|C|D",
  "explanation": "Giải thích ngắn gọn (1-2 câu)",
  "source": "Điều X, Khoản Y - Tên văn bản", 
  "confidence": 85
}

NGỮ CẢNH:
${context}

CÂU HỎI VÀ CÁC ĐÁP ÁN: ${question}

Trả về JSON theo format trên:
`;
      } else {
        // Generate multiple choice options
        return `
Bạn là trợ lý AI chuyên nghiệp vụ ngân hàng. Dựa trên các văn bản quy định được cung cấp, hãy tạo câu trả lời dạng trắc nghiệm cho câu hỏi.

NGUYÊN TẮC:
1. Phân tích câu hỏi và tìm đáp án CHÍNH XÁC từ tài liệu
2. Tạo 4 đáp án A, B, C, D (trong đó có 1 đáp án đúng và 3 đáp án sai hợp lý)
3. Đưa ra giải thích ngắn gọn với nguồn văn bản (điều, khoản cụ thể)
4. Trả về dưới dạng JSON với format:

{
  "correctAnswer": "A|B|C|D",
  "options": {
    "A": "Đáp án A",
    "B": "Đáp án B", 
    "C": "Đáp án C",
    "D": "Đáp án D"
  },
  "explanation": "Giải thích ngắn gọn (1-2 câu)",
  "source": "Điều X, Khoản Y - Tên văn bản",
  "confidence": 85
}

NGỮ CẢNH:
${context}

CÂU HỎI: ${question}

Trả về JSON theo format trên:
`;
      }
    } else {
      // Regular question OR prose format requested - return natural text response
      return `
Bạn là một trợ lý AI chuyên về pháp luật Việt Nam. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng dựa trên các văn bản pháp luật được cung cấp.

NGUYÊN TẮC TRẢ LỜI:
1. Trả lời CHÍNH XÁC dựa trên nội dung văn bản được cung cấp
2. Trích dẫn cụ thể điều, khoản liên quan TRONG CÂU bằng cách thêm ký hiệu [🔗1], [🔗2], [🔗3] ngay sau câu hoặc đoạn có liên quan
3. Nếu câu hỏi yêu cầu đếm, tính tổng, tóm tắt: hãy phân tích TOÀN BỘ nội dung được cung cấp và đưa ra kết quả chính xác
4. Khi liệt kê, hãy sắp xếp theo thứ tự logic (theo số điều, chương, hoặc thứ tự xuất hiện)
5. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, KHÔNG sử dụng markdown (*, #, **, _)
6. Viết câu trả lời tự nhiên như văn xuôi thông thường
7. Số [🔗n] tương ứng với nguồn thứ n trong danh sách ngữ cảnh bên dưới
8. Nếu nhiều nguồn hỗ trợ cùng một ý, có thể dùng [🔗1][🔗2]

VÍ DỤ FORMAT:
- Câu hỏi thông thường: "Theo quy định, người lao động có quyền nghỉ phép năm 12 ngày làm việc [🔗1]. Đối với những người làm việc trong điều kiện đặc biệt, thời gian nghỉ phép có thể tăng lên [🔗2][🔗3]."
- Câu hỏi đếm/tổng hợp: "Văn bản có tổng cộng 15 điều khoản về vấn đề này, bao gồm: Điều 5 về quyền lợi người lao động [🔗1], Điều 7 về nghĩa vụ của người sử dụng lao động [🔗3], Điều 12 về chế độ bảo hiểm [🔗5]..."

NGỮ CẢNH TỪ CÁC VĂN BẢN:
${context}

CÂU HỎI: ${question}

Hãy trả lời câu hỏi dựa trên ngữ cảnh trên, nhớ thêm trích dẫn [🔗n] sau mỗi câu/đoạn có liên quan.
`;
    }
  }

  /**
   * Check if question is a multiple choice question
   */
  private isMultipleChoiceQuestion(question: string): boolean {
    // Check for explicit multiple choice indicators
    const multipleChoiceIndicators = [
      'Các đáp án:',
      'A)', 'B)', 'C)', 'D)',
      'A.', 'B.', 'C.', 'D.',
      'a)', 'b)', 'c)', 'd)',
      'a.', 'b.', 'c.', 'd.',
      'chọn đáp án',
      'đáp án nào',
      'đáp án đúng',
      'lựa chọn nào',
      'phương án nào',
      'trường hợp nào',
      'câu nào đúng',
      'ý kiến nào',
      'tình huống nào'
    ];

    const lowerQuestion = question.toLowerCase();

    // Check if question contains explicit multiple choice patterns
    for (const indicator of multipleChoiceIndicators) {
      if (lowerQuestion.includes(indicator.toLowerCase())) {
        return true;
      }
    }

    // Check for option patterns like "A) option text B) option text"
    const optionPatterns = [
      /[A-D]\)[^\n]*[A-D]\)/i,  // A) text B) pattern
      /[A-D]\.[^\n]*[A-D]\./i,  // A. text B. pattern
      /[a-d]\)[^\n]*[a-d]\)/i,  // a) text b) pattern
      /[a-d]\.[^\n]*[a-d]\./i   // a. text b. pattern
    ];

    for (const pattern of optionPatterns) {
      if (pattern.test(question)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate answer using RAG (Retrieval-Augmented Generation)
   * @deprecated Use generateRAGAnswerStream for better UX
   */
  async generateRAGAnswerLegacy(
    query: RAGQuery,
    retrievedChunks: RetrievedChunk[]
  ): Promise<RAGResponse> {
    try {
      console.log(`[Gemini] Generating RAG answer for query: "${query.question.substring(0, 50)}..."`);

      // Build context from retrieved chunks
      const context = retrievedChunks
        .map((chunk, idx) => {
          const source = chunk.documentNumber
            ? `${chunk.documentName} (${chunk.documentNumber})`
            : chunk.documentName;

          let location = '';
          if (chunk.metadata.chapterNumber) {
            location += `Chương ${chunk.metadata.chapterNumber}`;
          }
          if (chunk.metadata.articleNumber) {
            location += location ? `, Điều ${chunk.metadata.articleNumber}` : `Điều ${chunk.metadata.articleNumber}`;
          }

          return `[${idx + 1}] ${source}${location ? ` - ${location}` : ''}:\n${chunk.content}`;
        })
        .join('\n\n---\n\n');

      const prompt = `
Bạn là một trợ lý AI chuyên về pháp luật Việt Nam. Nhiệm vụ của bạn là trả lời câu hỏi của người dùng dựa trên các văn bản pháp luật được cung cấp.

NGUYÊN TẮC TRẢ LỜI:
1. Trả lời CHÍNH XÁC dựa trên nội dung văn bản được cung cấp
2. Trích dẫn cụ thể điều, khoản liên quan TRONG CÂU bằng cách thêm ký hiệu [🔗1], [🔗2], [🔗3] ngay sau câu hoặc đoạn có liên quan
3. Nếu câu hỏi yêu cầu đếm, tính tổng, tóm tắt: hãy phân tích TOÀN BỘ nội dung được cung cấp và đưa ra kết quả chính xác
4. Khi liệt kê, hãy sắp xếp theo thứ tự logic (theo số điều, chương, hoặc thứ tự xuất hiện)
5. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, KHÔNG sử dụng markdown (*, #, **, _)
6. Viết câu trả lời tự nhiên như văn xuôi thông thường
7. Số [🔗n] tương ứng với nguồn thứ n trong danh sách ngữ cảnh bên dưới
8. Nếu nhiều nguồn hỗ trợ cùng một ý, có thể dùng [🔗1][🔗2]

VÍ DỤ FORMAT:
- Câu hỏi thông thường: "Theo quy định, người lao động có quyền nghỉ phép năm 12 ngày làm việc [🔗1]. Đối với những người làm việc trong điều kiện đặc biệt, thời gian nghỉ phép có thể tăng lên [🔗2][🔗3]."
- Câu hỏi đếm/tổng hợp: "Văn bản có tổng cộng 15 điều khoản về vấn đề này, bao gồm: Điều 5 về quyền lợi người lao động [🔗1], Điều 7 về nghĩa vụ của người sử dụng lao động [🔗3], Điều 12 về chế độ bảo hiểm [🔗5]..."

NGỮ CẢNH TỪ CÁC VĂN BẢN:
${context}

CÂU HỎI: ${query.question}

Hãy trả lời câu hỏi dựa trên ngữ cảnh trên, nhớ thêm trích dẫn [🔗n] sau mỗi câu/đoạn có liên quan.
`;

      const modelInfo = await this.getAnswerModel();

      // Generate answer with retry logic
      let lastError: any;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`[Gemini] RAG answer attempt ${attempt}/${this.maxRetries}`);

          const response = await this.ai.models.generateContent({
            model: modelInfo.name,
            contents: prompt,
          });

          const answer = response.text || '';

          // Get token usage (if available)
          const usageMetadata: any = (response as any).usageMetadata || {};
          const inputTokens = usageMetadata.promptTokenCount || 0;
          const outputTokens = usageMetadata.candidatesTokenCount || 0;
          const totalTokens = usageMetadata.totalTokenCount || inputTokens + outputTokens;

          console.log(`[Gemini] RAG answer generated, tokens: ${totalTokens}`);

          // Calculate confidence based on retrieval scores
          const avgScore = retrievedChunks.reduce((sum, c) => sum + c.score, 0) / retrievedChunks.length;
          const confidence = Math.round(avgScore * 100);

          return {
            answer,
            sources: retrievedChunks,
            model: modelInfo.name,
            confidence,
            tokenUsage: {
              input: inputTokens,
              output: outputTokens,
              total: totalTokens,
            },
          };
        } catch (error) {
          lastError = error;

          if (this.isRetryableError(error) && attempt < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            console.warn(`[Gemini] RAG answer retry ${attempt}/${this.maxRetries}: ${error}`);
            console.log(`[Gemini] Waiting ${delay}ms before retry...`);
            await this.sleep(delay);
            continue;
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (error) {
      console.error('[Gemini] RAG answer generation failed:', error);
      throw new Error(`Failed to generate answer: ${error}`);
    }
  }

  /**
   * Convert DocumentContent to Markdown
   */
  convertToMarkdown(content: DocumentContent): string {
    let markdown = '';

    // Overview
    const { overview } = content;
    markdown += `# ${overview.documentName}\n\n`;

    if (overview.documentNumber) {
      markdown += `**Số văn bản:** ${overview.documentNumber}\n\n`;
    }
    if (overview.documentType) {
      markdown += `**Loại văn bản:** ${overview.documentType}\n\n`;
    }
    if (overview.issuingAgency) {
      markdown += `**Cơ quan ban hành:** ${overview.issuingAgency}\n\n`;
    }
    if (overview.signer) {
      markdown += `**Người ký:** ${overview.signer.name}`;
      if (overview.signer.title) {
        markdown += ` - ${overview.signer.title}`;
      }
      markdown += '\n\n';
    }
    if (overview.signedDate) {
      markdown += `**Ngày ký:** ${overview.signedDate}\n\n`;
    }

    markdown += '---\n\n';

    // Basis
    if (content.basis && content.basis.length > 0) {
      markdown += '## Căn cứ\n\n';
      content.basis.forEach((basis) => {
        markdown += `- ${basis.type}`;
        if (basis.number) markdown += ` số ${basis.number}`;
        markdown += ` ${basis.name}`;
        if (basis.date) markdown += ` ngày ${basis.date}`;
        markdown += '\n';
      });
      markdown += '\n';
    }

    // Chapters or Articles
    if (content.chapters && content.chapters.length > 0) {
      // Document has chapters
      content.chapters.forEach((chapter) => {
        markdown += `## Chương ${chapter.number}: ${chapter.title}\n\n`;

        chapter.articles.forEach((article) => {
          markdown += `### Điều ${article.number}`;
          if (article.title) markdown += `. ${article.title}`;
          markdown += '\n\n';

          if (article.content) {
            markdown += `${article.content}\n\n`;
          }

          if (article.sections && article.sections.length > 0) {
            article.sections.forEach((section) => {
              if (section.number) {
                markdown += `${section.number}. ${section.content}\n\n`;
              } else {
                markdown += `${section.content}\n\n`;
              }

              if (section.subsections && section.subsections.length > 0) {
                section.subsections.forEach((sub) => {
                  markdown += `   ${sub}\n\n`;
                });
              }
            });
          }
        });
      });
    } else if (content.articles && content.articles.length > 0) {
      // Document has no chapters, only articles
      content.articles.forEach((article) => {
        markdown += `## Điều ${article.number}`;
        if (article.title) markdown += `. ${article.title}`;
        markdown += '\n\n';

        if (article.content) {
          markdown += `${article.content}\n\n`;
        }

        if (article.sections && article.sections.length > 0) {
          article.sections.forEach((section) => {
            if (section.number) {
              markdown += `${section.number}. ${section.content}\n\n`;
            } else {
              markdown += `${section.content}\n\n`;
            }

            if (section.subsections && section.subsections.length > 0) {
              section.subsections.forEach((sub) => {
                markdown += `   ${sub}\n\n`;
              });
            }
          });
        }
      });
    }

    // Appendices
    if (content.appendices && content.appendices.length > 0) {
      markdown += '---\n\n';
      content.appendices.forEach((appendix) => {
        markdown += `## Phụ lục ${appendix.number || ''}: ${appendix.title}\n\n`;
        markdown += `${appendix.content}\n\n`;
      });
    }

    return markdown;
  }
}

// Export singleton instances
// Default instance using GEMINI_API_KEY for chat queries
export const geminiRAGService = new GeminiRAGService();

// Import instance using GEMINI_API_KEY_IMPORT for file import/embedding
export const geminiRAGServiceImport = new GeminiRAGService(process.env.GEMINI_API_KEY_IMPORT);
