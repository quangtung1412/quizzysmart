/**
 * Collection Routes
 * 
 * Admin endpoints for managing Qdrant collections
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { qdrantService } from '../services/qdrant.service.js';

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
 * GET /api/admin/collections
 * List all collections
 */
router.get('/collections', requireAdmin, async (req: Request, res: Response) => {
  try {
    const collections = await qdrantService.listCollections();
    
    res.json({
      success: true,
      collections,
    });
  } catch (error) {
    console.error('[Collections API] List failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list collections',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/collections/:name
 * Get detailed information about a specific collection
 */
router.get('/collections/:name', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const info = await qdrantService.getCollectionInfo(name);
    
    res.json({
      success: true,
      collection: info,
    });
  } catch (error) {
    console.error('[Collections API] Get info failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collection info',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/collections
 * Create a new collection
 */
router.post('/collections', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, vectorSize, distance, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Collection name is required',
      });
    }

    // Validate collection name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        error: 'Collection name can only contain letters, numbers, hyphens, and underscores',
      });
    }

    await qdrantService.createCollection(name, {
      vectorSize,
      distance,
      description,
    });

    res.json({
      success: true,
      message: `Collection "${name}" created successfully`,
    });
  } catch (error) {
    console.error('[Collections API] Create failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create collection',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/admin/collections/:name
 * Delete a collection
 */
router.delete('/collections/:name', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    await qdrantService.deleteCollection(name);

    res.json({
      success: true,
      message: `Collection "${name}" deleted successfully`,
    });
  } catch (error) {
    console.error('[Collections API] Delete failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete collection',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/collections/:name/exists
 * Check if a collection exists
 */
router.get('/collections/:name/exists', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const exists = await qdrantService.collectionExists(name);
    
    res.json({
      success: true,
      exists,
    });
  } catch (error) {
    console.error('[Collections API] Check existence failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check collection existence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
