/**
 * Gemini RAG Service
 * 
 * Handles PDF extraction, embedding, and answer generation using Google Gemini AI
 */

import { GoogleGenAI, createPartFromUri } from '@google/genai';
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

class GeminiRAGService {
  private ai: GoogleGenAI;
  private embeddingModel = 'text-embedding-004';
  private maxRetries = 3;
  private retryDelay = 2000; // Start with 2 seconds

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }

    this.ai = new GoogleGenAI({ apiKey });
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

Hãy phân tích văn bản PDF và trả về JSON theo đúng cấu trúc trên.
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
          
          const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
          });

          const text = response.text || '';
          console.log(`[Gemini] Extraction completed successfully`);

          // Parse JSON response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from Gemini response');
          }

          const documentContent: DocumentContent = JSON.parse(jsonMatch[0]);

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
  async generateEmbedding(text: string): Promise<number[]> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.ai.models.embedContent({
          model: this.embeddingModel,
          contents: text,
        });
        
        if (!result.embeddings || result.embeddings.length === 0 || !result.embeddings[0].values) {
          throw new Error('Invalid embedding response');
        }

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
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      console.log(`[Gemini] Generating embeddings for ${texts.length} texts`);

      const embeddings: number[][] = [];

      // Process in batches of 10 to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((text) => this.generateEmbedding(text))
        );
        embeddings.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(`[Gemini] Generated ${embeddings.length} embeddings`);
      return embeddings;
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

      const prompt = this.buildRAGPrompt(query.question, context);

      const modelInfo = await geminiModelRotation.getNextAvailableModel();
      if (!modelInfo) {
        throw new Error('No available Gemini models');
      }
      
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
   * Generate answer using RAG with streaming
   */
  async *generateRAGAnswerStream(
    query: RAGQuery,
    retrievedChunks: RetrievedChunk[]
  ): AsyncGenerator<{ chunk: string; done: boolean; metadata?: any }> {
    try {
      console.log(`[Gemini] Generating streaming RAG answer for query: "${query.question.substring(0, 50)}..."`);

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

      const prompt = this.buildRAGPrompt(query.question, context);

      const modelInfo = await geminiModelRotation.getNextAvailableModel();
      if (!modelInfo) {
        throw new Error('No available Gemini models');
      }
      
      console.log(`[Gemini] Streaming with model: ${modelInfo.name}`);
      
      const streamPromise = this.ai.models.generateContentStream({
        model: modelInfo.name,
        contents: prompt,
      });

      const stream = await streamPromise;

      let fullText = '';
      for await (const chunk of stream) {
        const text = chunk.text || '';
        fullText += text;
        yield { chunk: text, done: false };
      }

      // Calculate confidence based on retrieval scores
      const avgScore = retrievedChunks.reduce((sum, c) => sum + c.score, 0) / retrievedChunks.length;
      const confidence = Math.round(avgScore * 100);

      console.log(`[Gemini] Streaming completed, total length: ${fullText.length}`);

      // Final chunk with metadata
      yield {
        chunk: '',
        done: true,
        metadata: {
          model: modelInfo.name,
          confidence,
          sources: retrievedChunks,
        }
      };
    } catch (error) {
      console.error('[Gemini] RAG streaming failed:', error);
      throw new Error(`Failed to stream answer: ${error}`);
    }
  }

  /**
   * Build RAG prompt
   */
  private buildRAGPrompt(question: string, context: string): string {
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

      const modelInfo = await geminiModelRotation.getNextAvailableModel();
      if (!modelInfo) {
        throw new Error('No available Gemini models');
      }
      
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

// Export singleton instance
export const geminiRAGService = new GeminiRAGService();
