/**
 * RAG Configuration Routes (Admin Only)
 * 
 * Endpoints for managing RAG method and File Search stores
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ragRouterService } from '../services/rag-router.service.js';
import { geminiFileSearchService, geminiFileSearchServiceImport } from '../services/gemini-file-search.service.js';

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
 * GET /api/rag-config
 * Get current RAG configuration
 */
router.get('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const config = await ragRouterService.getRAGConfig();
        const stats = await ragRouterService.getRAGStats();

        res.json({
            success: true,
            config,
            stats,
        });
    } catch (error) {
        console.error('[RAG Config] Get config error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy cấu hình RAG',
        });
    }
});

/**
 * POST /api/rag-config
 * Set RAG configuration
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { method, fileSearchStoreName } = req.body;

        if (!method || !['qdrant', 'google-file-search'].includes(method)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid RAG method. Must be "qdrant" or "google-file-search"',
            });
        }

        if (method === 'google-file-search' && !fileSearchStoreName) {
            return res.status(400).json({
                success: false,
                error: 'File Search store name is required for google-file-search method',
            });
        }

        await ragRouterService.setRAGConfig(method, fileSearchStoreName);

        res.json({
            success: true,
            message: `RAG method updated to: ${method}`,
            config: {
                method,
                fileSearchStoreName: method === 'google-file-search' ? fileSearchStoreName : undefined,
            },
        });
    } catch (error: any) {
        console.error('[RAG Config] Set config error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi khi cập nhật cấu hình RAG',
        });
    }
});

/**
 * GET /api/rag-config/file-search-stores
 * List all Google File Search stores
 */
router.get('/file-search-stores', requireAdmin, async (req: Request, res: Response) => {
    try {
        const stores = await geminiFileSearchService.listFileSearchStores();

        res.json({
            success: true,
            stores,
        });
    } catch (error) {
        console.error('[RAG Config] List stores error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy danh sách File Search stores',
        });
    }
});

/**
 * POST /api/rag-config/file-search-stores
 * Create a new Google File Search store
 */
router.post('/file-search-stores', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { displayName } = req.body;

        if (!displayName) {
            return res.status(400).json({
                success: false,
                error: 'Display name is required',
            });
        }

        const store = await geminiFileSearchServiceImport.createFileSearchStore(displayName);

        res.json({
            success: true,
            message: 'File Search store created successfully',
            store,
        });
    } catch (error: any) {
        console.error('[RAG Config] Create store error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi khi tạo File Search store',
        });
    }
});

/**
 * DELETE /api/rag-config/file-search-stores/:storeName
 * Delete a Google File Search store
 */
router.delete('/file-search-stores/:storeName', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { storeName } = req.params;

        // Check if this store is currently in use
        const config = await ragRouterService.getRAGConfig();
        if (config.method === 'google-file-search' && config.fileSearchStoreName === storeName) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete store that is currently in use. Switch to another method or store first.',
            });
        }

        await geminiFileSearchService.deleteFileSearchStore(storeName, true);

        res.json({
            success: true,
            message: 'File Search store deleted successfully',
        });
    } catch (error: any) {
        console.error('[RAG Config] Delete store error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi khi xóa File Search store',
        });
    }
});

/**
 * POST /api/rag-config/upload-to-file-search
 * Upload a PDF to Google File Search store (multipart/form-data)
 */
router.post('/upload-to-file-search', requireAdmin, async (req: Request, res: Response) => {
    try {
        const multer = (await import('multer')).default;
        const path = await import('path');
        const fs = await import('fs/promises');

        // Setup multer for file upload
        const upload = multer({
            dest: 'uploads/temp/',
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'application/pdf') {
                    cb(null, true);
                } else {
                    cb(new Error('Only PDF files are allowed'));
                }
            },
        });

        // Handle multipart upload
        upload.single('file')(req, res, async (uploadErr) => {
            if (uploadErr) {
                return res.status(400).json({
                    success: false,
                    error: uploadErr.message || 'Upload error',
                });
            }

            try {
                const file = req.file;
                const { fileSearchStoreName, displayName } = req.body;

                if (!file) {
                    return res.status(400).json({
                        success: false,
                        error: 'No file uploaded',
                    });
                }

                if (!fileSearchStoreName) {
                    // Clean up temp file
                    await fs.unlink(file.path);
                    return res.status(400).json({
                        success: false,
                        error: 'File Search store name is required',
                    });
                }

                // Verify store exists
                const store = await geminiFileSearchService.getFileSearchStore(fileSearchStoreName);
                if (!store) {
                    await fs.unlink(file.path);
                    return res.status(404).json({
                        success: false,
                        error: `File Search store "${fileSearchStoreName}" not found`,
                    });
                }

                console.log(`[RAG Config] Uploading ${displayName || file.originalname} to File Search...`);

                // Upload to File Search
                const fileSearchDoc = await geminiFileSearchServiceImport.uploadPDFToStore(
                    file.path,
                    fileSearchStoreName,
                    displayName || file.originalname,
                    {
                        uploadedBy: (req as any).user?.email,
                    } as any
                );

                // Save document record to database
                const document = await (prisma as any).document.create({
                    data: {
                        fileName: file.originalname,
                        filePath: file.path,
                        fileSize: file.size,
                        documentName: displayName || file.originalname,
                        fileSearchStoreName,
                        fileSearchDocumentName: fileSearchDoc.name,
                        ragMethod: 'google-file-search',
                        processingStatus: 'completed',
                        uploadedBy: (req as any).user?.id || 'system',
                        rawContent: '', // File Search doesn't extract text locally
                        markdownContent: '', // File Search handles content internally
                    },
                });

                res.json({
                    success: true,
                    message: 'Document uploaded to File Search successfully',
                    document: {
                        id: document.id,
                        fileName: document.fileName,
                        documentName: document.documentName,
                        fileSearchStoreName: document.fileSearchStoreName,
                        fileSearchDocumentName: document.fileSearchDocumentName,
                    },
                    fileSearchDocument: fileSearchDoc,
                });
            } catch (error: any) {
                // Clean up temp file
                if (req.file) {
                    await fs.unlink(req.file.path).catch(() => { });
                }

                console.error('[RAG Config] Upload to File Search error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Lỗi khi upload lên File Search',
                });
            }
        });
    } catch (error: any) {
        console.error('[RAG Config] Upload setup error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi khi thiết lập upload',
        });
    }
});

/**
 * GET /api/rag-config/documents
 * Get documents list with optional filters
 */
router.get('/documents', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { ragMethod, fileSearchStoreName } = req.query;

        const where: any = {};
        if (ragMethod) {
            where.ragMethod = ragMethod;
        }
        if (fileSearchStoreName) {
            where.fileSearchStoreName = fileSearchStoreName;
        }

        const documents = await (prisma as any).document.findMany({
            where,
            orderBy: { uploadedAt: 'desc' },
            select: {
                id: true,
                fileName: true,
                documentName: true,
                documentNumber: true,
                ragMethod: true,
                fileSearchStoreName: true,
                fileSearchDocumentName: true,
                processingStatus: true,
                uploadedAt: true,
                uploadedBy: true,
            },
        });

        res.json({
            success: true,
            documents,
        });
    } catch (error) {
        console.error('[RAG Config] Get documents error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy danh sách tài liệu',
        });
    }
});

/**
 * DELETE /api/rag-config/documents/:id
 * Delete a document
 */
router.delete('/documents/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const document = await prisma.document.findUnique({
            where: { id },
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found',
            });
        }

        // If document is in File Search, we can't delete it from there (API limitation)
        // Just remove from database
        await prisma.document.delete({
            where: { id },
        });

        // Optionally delete file from disk
        const fs = await import('fs/promises');
        try {
            await fs.unlink(document.filePath);
        } catch (err) {
            console.warn(`[RAG Config] Could not delete file: ${document.filePath}`);
        }

        res.json({
            success: true,
            message: 'Document deleted successfully',
        });
    } catch (error) {
        console.error('[RAG Config] Delete document error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi xóa tài liệu',
        });
    }
});

/**
 * GET /api/rag-config/stats
 * Get RAG statistics
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
    try {
        const stats = await ragRouterService.getRAGStats();

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('[RAG Config] Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy thống kê RAG',
        });
    }
});

export default router;
