/**
 * PDF Processor Service
 * 
 * Handles PDF processing, chunking, and embedding
 * Uses dynamic chunking based on document structure
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  DocumentContent,
  DocumentChunkData,
  ChunkMetadata,
  ChunkType,
  QdrantPoint,
  ProcessingProgress,
} from '../types/rag.types.js';
import { geminiRAGServiceImport } from './gemini-rag.service.js'; // Use IMPORT service for file processing
import { qdrantService } from './qdrant.service.js';
import type { Server as SocketServer } from 'socket.io';

const prisma = new PrismaClient();

class PDFProcessorService {
  private io: SocketServer | null = null;

  /**
   * Set Socket.IO instance for real-time updates
   */
  setSocketIO(io: SocketServer): void {
    this.io = io;
  }

  /**
   * Send processing update via Socket.IO
   */
  private emitProgress(userId: string, progress: ProcessingProgress): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('document:processing', progress);
      console.log(`[PDFProcessor] Progress update sent to user ${userId}:`, progress.currentStep);
    }
  }

  /**
   * Process a single uploaded PDF document
   */
  async processDocument(
    documentId: string,
    filePath: string,
    fileName: string,
    userId: string
  ): Promise<void> {
    try {
      console.log(`[PDFProcessor] Starting processing for document ${documentId}`);

      // Update status to processing
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'processing',
          processingStartedAt: new Date(),
        },
      });

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 10,
        currentStep: 'Đang upload PDF lên Gemini...',
      });

      // Step 1: Upload PDF to Gemini (using IMPORT key)
      const fileUri = await geminiRAGServiceImport.uploadPDF(filePath, fileName);

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 30,
        currentStep: 'Đang trích xuất nội dung văn bản...',
      });

      // Step 2: Extract structured content (using IMPORT key)
      const extraction = await geminiRAGServiceImport.extractDocumentContent(fileUri);
      const { content } = extraction;

      // Step 3: Convert to Markdown
      const markdownContent = geminiRAGServiceImport.convertToMarkdown(content);

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 50,
        currentStep: 'Đang lưu metadata và nội dung...',
      });

      // Step 4: Save metadata and content to database
      // Parse and validate signedDate
      let signedDate: Date | null = null;
      if (content.overview.signedDate) {
        try {
          const parsedDate = new Date(content.overview.signedDate);
          // Check if date is valid
          if (!isNaN(parsedDate.getTime())) {
            signedDate = parsedDate;
          } else {
            console.warn(`[PDF Processor] Invalid signedDate: ${content.overview.signedDate}`);
          }
        } catch (error) {
          console.warn(`[PDF Processor] Failed to parse signedDate: ${content.overview.signedDate}`, error);
        }
      }

      await prisma.document.update({
        where: { id: documentId },
        data: {
          documentNumber: content.overview.documentNumber,
          documentName: content.overview.documentName,
          documentType: content.overview.documentType,
          issuingAgency: content.overview.issuingAgency,
          signerName: content.overview.signer?.name,
          signerTitle: content.overview.signer?.title,
          signedDate: signedDate,
          rawContent: JSON.stringify(content),
          markdownContent,
        },
      });

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 60,
        currentStep: 'Đang phân đoạn văn bản...',
      });

      // Step 5: Create chunks based on structure
      const chunks = this.createChunks(documentId, content, markdownContent);

      console.log(`[PDFProcessor] Created ${chunks.length} chunks`);

      // Step 6: Save chunks to database
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await prisma.documentChunk.create({
          data: {
            documentId,
            chunkIndex: chunk.metadata.chunkIndex,
            chunkType: chunk.metadata.chunkType,
            content: chunk.content,
            metadata: JSON.stringify(chunk.metadata),
            embeddingStatus: 'pending',
          },
        });
      }

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 70,
        currentStep: 'Đang tạo embeddings...',
        chunksCreated: chunks.length,
      });

      // Step 7: Generate embeddings and upload to Qdrant
      await this.embedAndUploadChunks(documentId, chunks, userId);

      // Step 8: Mark as completed
      const pointIds = chunks.map((_, idx) => `${documentId}_chunk_${idx}`);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'completed',
          processingCompletedAt: new Date(),
          qdrantPointIds: JSON.stringify(pointIds),
        },
      });

      this.emitProgress(userId, {
        documentId,
        status: 'completed',
        progress: 100,
        currentStep: 'Hoàn thành!',
        chunksCreated: chunks.length,
        chunksEmbedded: chunks.length,
      });

      console.log(`[PDFProcessor] Document ${documentId} processed successfully`);
    } catch (error) {
      console.error(`[PDFProcessor] Processing failed for document ${documentId}:`, error);

      // Update status to failed
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'failed',
          errorMessage: String(error),
        },
      });

      this.emitProgress(userId, {
        documentId,
        status: 'failed',
        progress: 0,
        currentStep: 'Lỗi xử lý',
        error: String(error),
      });

      throw error;
    }
  }

  /**
   * Re-generate embeddings for existing document chunks
   */
  async reEmbedDocument(
    documentId: string,
    content: DocumentContent,
    userId: string
  ): Promise<void> {
    try {
      console.log(`[PDFProcessor] Starting re-embedding for document ${documentId}`);

      // Get document to retrieve collection name
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      const collectionName = document.qdrantCollectionName || 'vietnamese_documents';

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 10,
        currentStep: 'Đang tải chunks...',
      });

      // Get existing chunks from database
      const dbChunks = await prisma.documentChunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' },
      });

      if (dbChunks.length === 0) {
        throw new Error('No chunks found for document');
      }

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 30,
        currentStep: `Tìm thấy ${dbChunks.length} chunks. Đang tạo embeddings...`,
        chunksCreated: dbChunks.length,
      });

      // Generate embeddings (using IMPORT key for re-embedding)
      const embeddings = await geminiRAGServiceImport.generateEmbeddings(
        dbChunks.map((c) => c.content)
      );

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 70,
        currentStep: 'Đang upload lên Qdrant...',
        chunksCreated: dbChunks.length,
      });

      // Create Qdrant points with new UUIDs
      const points: QdrantPoint[] = dbChunks.map((chunk, idx) => {
        const pointId = randomUUID();
        const metadata = JSON.parse(chunk.metadata);

        return {
          id: pointId,
          vector: embeddings[idx],
          payload: {
            documentId,
            documentNumber: metadata.documentNumber,
            documentName: metadata.documentName,
            documentType: metadata.documentType,
            chunkType: chunk.chunkType as ChunkType,
            chunkIndex: chunk.chunkIndex,
            chapterNumber: metadata.chapterNumber,
            chapterTitle: metadata.chapterTitle,
            articleNumber: metadata.articleNumber,
            articleTitle: metadata.articleTitle,
            sectionNumber: metadata.sectionNumber,
            content: chunk.content,
            contentPreview: chunk.content.substring(0, 200),
          },
        };
      });

      // Upload to Qdrant with specified collection
      await qdrantService.upsertPoints(points, collectionName);

      // Update chunk embedding status
      for (let i = 0; i < dbChunks.length; i++) {
        await prisma.documentChunk.update({
          where: { id: dbChunks[i].id },
          data: {
            qdrantPointId: points[i].id as string,
            embeddingStatus: 'completed',
          },
        });
      }

      // Mark as completed
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'completed',
        },
      });

      this.emitProgress(userId, {
        documentId,
        status: 'completed',
        progress: 100,
        currentStep: 'Hoàn thành!',
        chunksCreated: dbChunks.length,
      });

      console.log(`[PDFProcessor] Re-embedding completed for document ${documentId}`);
    } catch (error) {
      console.error(`[PDFProcessor] Re-embedding failed for document ${documentId}:`, error);

      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: 'failed',
          errorMessage: String(error),
        },
      });

      this.emitProgress(userId, {
        documentId,
        status: 'failed',
        progress: 0,
        currentStep: 'Lỗi khi tạo embedding',
        error: String(error),
      });

      throw error;
    }
  }

  /**
   * Create chunks from document content based on structure
   * Dynamic chunking: overview → basis → chapters/articles
   */
  private createChunks(
    documentId: string,
    content: DocumentContent,
    markdownContent: string
  ): DocumentChunkData[] {
    const chunks: DocumentChunkData[] = [];
    let chunkIndex = 0;

    const baseMetadata = {
      documentId,
      documentNumber: content.overview.documentNumber,
      documentName: content.overview.documentName,
      documentType: content.overview.documentType,
    };

    // Chunk 1: Overview (metadata summary)
    chunks.push({
      content: this.createOverviewChunk(content),
      metadata: {
        ...baseMetadata,
        chunkType: 'overview',
        chunkIndex: chunkIndex++,
      },
    });

    // Chunk 2: Basis (if exists)
    if (content.basis && content.basis.length > 0) {
      chunks.push({
        content: this.createBasisChunk(content.basis),
        metadata: {
          ...baseMetadata,
          chunkType: 'basis',
          chunkIndex: chunkIndex++,
        },
      });
    }

    // Chunks for Chapters/Articles
    if (content.chapters && content.chapters.length > 0) {
      // Document has chapters
      for (let chapterIdx = 0; chapterIdx < content.chapters.length; chapterIdx++) {
        const chapter = content.chapters[chapterIdx];
        for (let artIdx = 0; artIdx < chapter.articles.length; artIdx++) {
          const article = chapter.articles[artIdx];
          const prevArticle = artIdx > 0 ? chapter.articles[artIdx - 1] : null;
          const nextArticle = artIdx < chapter.articles.length - 1 ? chapter.articles[artIdx + 1] : null;

          const articleChunks = this.createArticleChunksWithContext(
            article,
            baseMetadata,
            chunkIndex,
            chapter.number,
            chapter.title,
            prevArticle,
            nextArticle
          );
          chunks.push(...articleChunks);
          chunkIndex += articleChunks.length;
        }
      }
    } else if (content.articles && content.articles.length > 0) {
      // Document has no chapters, only articles
      for (let artIdx = 0; artIdx < content.articles.length; artIdx++) {
        const article = content.articles[artIdx];
        const prevArticle = artIdx > 0 ? content.articles[artIdx - 1] : null;
        const nextArticle = artIdx < content.articles.length - 1 ? content.articles[artIdx + 1] : null;

        const articleChunks = this.createArticleChunksWithContext(
          article,
          baseMetadata,
          chunkIndex,
          undefined,
          undefined,
          prevArticle,
          nextArticle
        );
        chunks.push(...articleChunks);
        chunkIndex += articleChunks.length;
      }
    }

    // Chunks for Appendices (if exists)
    if (content.appendices && content.appendices.length > 0) {
      for (const appendix of content.appendices) {
        chunks.push({
          content: `# Phụ lục ${appendix.number || ''}: ${appendix.title}\n\n${appendix.content}`,
          metadata: {
            ...baseMetadata,
            chunkType: 'appendix',
            chunkIndex: chunkIndex++,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Create overview chunk
   */
  private createOverviewChunk(content: DocumentContent): string {
    const { overview } = content;
    let text = `# ${overview.documentName}\n\n`;

    if (overview.documentNumber) text += `**Số:** ${overview.documentNumber}\n`;
    if (overview.documentType) text += `**Loại:** ${overview.documentType}\n`;
    if (overview.issuingAgency) text += `**Cơ quan:** ${overview.issuingAgency}\n`;
    if (overview.signer?.name) {
      text += `**Người ký:** ${overview.signer.name}`;
      if (overview.signer.title) text += ` (${overview.signer.title})`;
      text += '\n';
    }
    if (overview.signedDate) text += `**Ngày ký:** ${overview.signedDate}\n`;

    return text;
  }

  /**
   * Create basis chunk
   */
  private createBasisChunk(basis: any[]): string {
    let text = '## Căn cứ pháp lý\n\n';
    basis.forEach((b) => {
      text += `- ${b.type}`;
      if (b.number) text += ` số ${b.number}`;
      text += ` ${b.name}`;
      if (b.date) text += ` ngày ${b.date}`;
      text += '\n';
    });
    return text;
  }

  /**
   * Create chunks for an article WITH OVERLAPPING CONTEXT
   * Includes context from chapter title and surrounding articles
   */
  private createArticleChunksWithContext(
    article: any,
    baseMetadata: any,
    startIndex: number,
    chapterNumber?: string,
    chapterTitle?: string,
    prevArticle?: any,
    nextArticle?: any
  ): DocumentChunkData[] {
    const chunks: DocumentChunkData[] = [];

    // Build article content with context
    let content = '';

    // Add chapter context if exists
    if (chapterNumber && chapterTitle) {
      content += `[Context: Chương ${chapterNumber}. ${chapterTitle}]\n\n`;
    }

    // Add previous article context (abbreviated)
    if (prevArticle) {
      content += `[Context trước] Điều ${prevArticle.number}`;
      if (prevArticle.title) content += `. ${prevArticle.title}`;
      content += '\n\n';
    }

    // Main article content
    content += `## Điều ${article.number}`;
    if (article.title) content += `. ${article.title}`;
    content += '\n\n';

    if (article.content) {
      content += `${article.content}\n\n`;
    }

    if (article.sections && article.sections.length > 0) {
      article.sections.forEach((section: any) => {
        if (section.number) {
          content += `${section.number}. ${section.content}\n\n`;
        } else {
          content += `${section.content}\n\n`;
        }

        if (section.subsections && section.subsections.length > 0) {
          section.subsections.forEach((sub: string) => {
            content += `   ${sub}\n\n`;
          });
        }
      });
    }

    // Add next article context (abbreviated)
    if (nextArticle) {
      content += `[Context sau] Điều ${nextArticle.number}`;
      if (nextArticle.title) content += `. ${nextArticle.title}`;
      content += '\n\n';
    }

    chunks.push({
      content,
      metadata: {
        ...baseMetadata,
        chunkType: 'article',
        chunkIndex: startIndex,
        chapterNumber,
        chapterTitle,
        articleNumber: article.number,
        articleTitle: article.title,
      },
    });

    return chunks;
  }

  /**
   * Create chunks for an article
   */
  private createArticleChunks(
    article: any,
    baseMetadata: any,
    startIndex: number,
    chapterNumber?: string,
    chapterTitle?: string
  ): DocumentChunkData[] {
    const chunks: DocumentChunkData[] = [];

    // Build article content
    let content = `## Điều ${article.number}`;
    if (article.title) content += `. ${article.title}`;
    content += '\n\n';

    if (article.content) {
      content += `${article.content}\n\n`;
    }

    if (article.sections && article.sections.length > 0) {
      article.sections.forEach((section: any) => {
        if (section.number) {
          content += `${section.number}. ${section.content}\n\n`;
        } else {
          content += `${section.content}\n\n`;
        }

        if (section.subsections && section.subsections.length > 0) {
          section.subsections.forEach((sub: string) => {
            content += `   ${sub}\n\n`;
          });
        }
      });
    }

    chunks.push({
      content,
      metadata: {
        ...baseMetadata,
        chunkType: 'article',
        chunkIndex: startIndex,
        chapterNumber,
        chapterTitle,
        articleNumber: article.number,
        articleTitle: article.title,
      },
    });

    return chunks;
  }

  /**
   * Generate embeddings and upload to Qdrant
   */
  private async embedAndUploadChunks(
    documentId: string,
    chunks: DocumentChunkData[],
    userId: string
  ): Promise<void> {
    try {
      // Get document to retrieve collection name
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      const collectionName = document.qdrantCollectionName || 'vietnamese_documents';

      // Generate embeddings in batches (using IMPORT key for file processing)
      const contents = chunks.map((c) => c.content);
      const embeddings = await geminiRAGServiceImport.generateEmbeddings(contents);

      this.emitProgress(userId, {
        documentId,
        status: 'processing',
        progress: 85,
        currentStep: 'Đang upload lên Qdrant...',
        chunksCreated: chunks.length,
      });

      // Create Qdrant points with UUID IDs
      const points: QdrantPoint[] = chunks.map((chunk, idx) => {
        // Generate a consistent UUID based on documentId and chunk index
        // Use randomUUID() for unique IDs each time
        const pointId = randomUUID();

        return {
          id: pointId,
          vector: embeddings[idx],
          payload: {
            documentId,
            documentNumber: chunk.metadata.documentNumber,
            documentName: chunk.metadata.documentName,
            documentType: chunk.metadata.documentType,
            chunkType: chunk.metadata.chunkType,
            chunkIndex: chunk.metadata.chunkIndex,
            chapterNumber: chunk.metadata.chapterNumber,
            chapterTitle: chunk.metadata.chapterTitle,
            articleNumber: chunk.metadata.articleNumber,
            articleTitle: chunk.metadata.articleTitle,
            sectionNumber: chunk.metadata.sectionNumber,
            content: chunk.content,
            contentPreview: chunk.content.substring(0, 200),
          },
        };
      });

      // Upload to Qdrant with specified collection
      await qdrantService.upsertPoints(points, collectionName);

      // Update chunk embedding status with Qdrant point IDs
      for (let i = 0; i < chunks.length; i++) {
        await prisma.documentChunk.updateMany({
          where: {
            documentId,
            chunkIndex: i,
          },
          data: {
            qdrantPointId: points[i].id as string,
            embeddingStatus: 'completed',
          },
        });
      }

      console.log(`[PDFProcessor] Successfully embedded and uploaded ${chunks.length} chunks to collection: ${collectionName}`);
    } catch (error) {
      console.error('[PDFProcessor] Embedding/upload failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pdfProcessorService = new PDFProcessorService();
