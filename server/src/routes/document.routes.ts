/**
 * Document Routes (Admin Only)
 * 
 * Endpoints for managing RAG documents
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { uploadDocuments, handleUploadError } from '../middleware/upload.middleware.js';
import { pdfProcessorService } from '../services/pdf-processor.service.js';
import { qdrantService } from '../services/qdrant.service.js';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

/**
 * Middleware: Require admin role
 */
const requireAdmin = async (req: Request, res: Response, next: any) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * POST /api/documents/upload
 * Upload multiple PDF documents
 */
router.post(
  '/upload',
  requireAdmin,
  uploadDocuments,
  handleUploadError,
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      const userId = (req as any).user?.id;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Không có file nào được upload',
        });
      }

      console.log(`[Documents] Received ${files.length} files from user ${userId}`);

      const documents: any[] = [];
      const errors: any[] = [];

      // Create database records for each file
      for (const file of files) {
        try {
          const document = await prisma.document.create({
            data: {
              fileName: file.originalname,
              fileSize: file.size,
              filePath: file.path,
              uploadedBy: userId,
              documentName: file.originalname.replace('.pdf', ''),
              markdownContent: '',
              rawContent: '{}',
              processingStatus: 'processing',
            },
          });

          documents.push({
            id: document.id,
            fileName: document.fileName,
            status: document.processingStatus,
          });

          // Start processing in background (don't await)
          pdfProcessorService
            .processDocument(document.id, file.path, file.originalname, userId)
            .catch((error) => {
              console.error(`[Documents] Processing failed for ${document.id}:`, error);
            });
        } catch (error) {
          console.error(`[Documents] Failed to create record for ${file.originalname}:`, error);
          errors.push({
            fileName: file.originalname,
            error: String(error),
          });

          // Delete uploaded file if database creation failed
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      res.json({
        success: true,
        documents,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error('[Documents] Upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Lỗi server khi upload',
      });
    }
  }
);

/**
 * GET /api/documents
 * List all documents
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: {
        chunks: {
          select: {
            id: true,
          },
        },
      },
    });

    const response = {
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        documentName: doc.documentName,
        documentNumber: doc.documentNumber,
        documentType: doc.documentType,
        uploadedAt: doc.uploadedAt.toISOString(),
        processingStatus: doc.processingStatus,
        chunksCount: doc.chunks.length,
      })),
      total: documents.length,
    };

    res.json(response);
  } catch (error) {
    console.error('[Documents] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi server khi lấy danh sách',
    });
  }
});

/**
 * GET /api/documents/:id
 * Get document details
 */
router.get('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy document',
      });
    }

    const response = {
      id: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      uploadedAt: document.uploadedAt.toISOString(),
      uploadedBy: document.uploadedBy,
      
      // Metadata
      documentNumber: document.documentNumber,
      documentName: document.documentName,
      documentType: document.documentType,
      issuingAgency: document.issuingAgency,
      signerName: document.signerName,
      signerTitle: document.signerTitle,
      signedDate: document.signedDate?.toISOString(),
      
      // Content
      markdownContent: document.markdownContent,
      
      // Processing
      processingStatus: document.processingStatus,
      errorMessage: document.errorMessage,
      
      // Chunks
      chunks: document.chunks.map((chunk) => ({
        id: chunk.id,
        chunkType: chunk.chunkType,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: JSON.parse(chunk.metadata),
        embeddingStatus: chunk.embeddingStatus,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error('[Documents] Get detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi server khi lấy chi tiết',
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its chunks
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy document',
      });
    }

    // Delete from Qdrant
    try {
      await qdrantService.deleteDocumentPoints(id);
    } catch (error) {
      console.warn('[Documents] Failed to delete from Qdrant:', error);
      // Continue with database deletion
    }

    // Delete from database (will cascade to chunks)
    await prisma.document.delete({
      where: { id },
    });

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    res.json({
      success: true,
      message: 'Document đã được xóa',
    });
  } catch (error) {
    console.error('[Documents] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi server khi xóa',
    });
  }
});

/**
 * GET /api/documents/:id/chunks
 * Get all chunks for a document
 */
router.get('/:id/chunks', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: id },
      orderBy: { chunkIndex: 'asc' },
    });

    const response = chunks.map((chunk) => ({
      id: chunk.id,
      chunkType: chunk.chunkType,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      metadata: JSON.parse(chunk.metadata),
      embeddingStatus: chunk.embeddingStatus,
      qdrantPointId: chunk.qdrantPointId,
    }));

    res.json({
      success: true,
      chunks: response,
      total: chunks.length,
    });
  } catch (error) {
    console.error('[Documents] Get chunks error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi server khi lấy chunks',
    });
  }
});

/**
 * POST /api/documents/:id/re-extract
 * Re-extract content from PDF
 */
router.post('/:id/re-extract', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy document',
      });
    }

    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File PDF không tồn tại trên server',
      });
    }

    // Update status to processing
    await prisma.document.update({
      where: { id },
      data: {
        processingStatus: 'processing',
        errorMessage: null,
      },
    });

    // Delete old chunks and Qdrant points
    try {
      await qdrantService.deleteDocumentPoints(id);
    } catch (error) {
      console.warn('[Documents] Failed to delete old Qdrant points:', error);
    }

    await prisma.documentChunk.deleteMany({
      where: { documentId: id },
    });

    // Start re-processing in background
    pdfProcessorService
      .processDocument(document.id, document.filePath, document.fileName, userId)
      .catch((error) => {
        console.error(`[Documents] Re-processing failed for ${document.id}:`, error);
      });

    res.json({
      success: true,
      message: 'Bắt đầu extract lại document',
      documentId: id,
    });
  } catch (error) {
    console.error('[Documents] Re-extract error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi server khi re-extract',
    });
  }
});

/**
 * POST /api/documents/:id/re-embed
 * Re-generate embeddings for existing chunks
 */
router.post('/:id/re-embed', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: true,
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy document',
      });
    }

    if (document.chunks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document chưa có chunks. Hãy extract trước.',
      });
    }

    // Update status
    await prisma.document.update({
      where: { id },
      data: {
        processingStatus: 'processing',
      },
    });

    // Delete old Qdrant points
    try {
      await qdrantService.deleteDocumentPoints(id);
    } catch (error) {
      console.warn('[Documents] Failed to delete old Qdrant points:', error);
    }

    // Reset embedding status
    await prisma.documentChunk.updateMany({
      where: { documentId: id },
      data: {
        embeddingStatus: 'pending',
        qdrantPointId: null,
      },
    });

    // Start re-embedding in background
    const rawContent = JSON.parse(document.rawContent);
    pdfProcessorService
      .reEmbedDocument(document.id, rawContent, userId)
      .catch((error) => {
        console.error(`[Documents] Re-embedding failed for ${document.id}:`, error);
      });

    res.json({
      success: true,
      message: 'Bắt đầu tạo embedding lại',
      documentId: id,
    });
  } catch (error) {
    console.error('[Documents] Re-embed error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi server khi re-embed',
    });
  }
});

export default router;
