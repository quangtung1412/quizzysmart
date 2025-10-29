/**
 * Qdrant Vector Database Service
 * 
 * Handles all interactions with Qdrant Cloud for vector storage and retrieval
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type { 
  QdrantPoint, 
  QdrantSearchResult,
  ChunkMetadata 
} from '../types/rag.types.js';

class QdrantService {
  private client: QdrantClient | null = null;
  private collectionName: string;
  private vectorDimension = 768; // Google Embedding dimension

  constructor() {
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'vietnamese_documents';
  }

  /**
   * Initialize Qdrant client connection
   */
  async initialize(): Promise<void> {
    try {
      const qdrantUrl = process.env.QDRANT_URL;
      const qdrantApiKey = process.env.QDRANT_API_KEY;

      if (!qdrantUrl) {
        throw new Error('QDRANT_URL not configured in environment');
      }

      console.log('[Qdrant] Initializing connection to:', qdrantUrl);

      this.client = new QdrantClient({
        url: qdrantUrl,
        apiKey: qdrantApiKey,
      });

      // Test connection
      await this.client.getCollections();
      console.log('[Qdrant] Connection established successfully');

      // Ensure collection exists
      await this.ensureCollection();
    } catch (error) {
      console.error('[Qdrant] Initialization failed:', error);
      throw new Error(`Failed to initialize Qdrant: ${error}`);
    }
  }

  /**
   * Ensure the collection exists, create if it doesn't
   */
  private async ensureCollection(): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (exists) {
        console.log(`[Qdrant] Collection "${this.collectionName}" already exists`);
        return;
      }

      // Create collection with cosine similarity
      console.log(`[Qdrant] Creating collection "${this.collectionName}"...`);
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorDimension,
          distance: 'Cosine', // Cosine similarity for text embeddings
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 2,
      });

      // Create payload indexes for faster filtering
      await this.createPayloadIndexes();

      console.log(`[Qdrant] Collection "${this.collectionName}" created successfully`);
    } catch (error) {
      console.error('[Qdrant] Collection creation failed:', error);
      throw error;
    }
  }

  /**
   * Create indexes on payload fields for efficient filtering
   */
  private async createPayloadIndexes(): Promise<void> {
    if (!this.client) return;

    try {
      const indexFields = [
        'documentId',
        'documentNumber',
        'chunkType',
        'articleNumber',
      ];

      for (const field of indexFields) {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: field,
          field_schema: 'keyword',
        });
      }

      console.log('[Qdrant] Payload indexes created');
    } catch (error) {
      console.warn('[Qdrant] Failed to create payload indexes:', error);
      // Non-critical, continue
    }
  }

  /**
   * Upsert a single vector point
   */
  async upsertPoint(point: QdrantPoint): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector,
            payload: point.payload,
          },
        ],
      });

      console.log(`[Qdrant] Upserted point: ${point.id}`);
    } catch (error) {
      console.error(`[Qdrant] Failed to upsert point ${point.id}:`, error);
      throw error;
    }
  }

  /**
   * Upsert multiple vector points (batch)
   */
  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');
    if (points.length === 0) return;

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });

      console.log(`[Qdrant] Upserted ${points.length} points`);
    } catch (error) {
      console.error('[Qdrant] Batch upsert failed:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    queryVector: number[],
    options: {
      topK?: number;
      minScore?: number;
      documentIds?: string[];
      chunkTypes?: string[];
    } = {}
  ): Promise<QdrantSearchResult[]> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    const { topK = 5, minScore = 0.5, documentIds, chunkTypes } = options;

    try {
      // Build filter
      const filter: any = {
        must: [],
      };

      if (documentIds && documentIds.length > 0) {
        filter.must.push({
          key: 'documentId',
          match: {
            any: documentIds,
          },
        });
      }

      if (chunkTypes && chunkTypes.length > 0) {
        filter.must.push({
          key: 'chunkType',
          match: {
            any: chunkTypes,
          },
        });
      }

      const searchParams: any = {
        vector: queryVector,
        limit: topK,
        score_threshold: minScore,
      };

      // Only add filter if we have conditions
      if (filter.must.length > 0) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(this.collectionName, searchParams);

      return results.map((result) => ({
        id: String(result.id),
        score: result.score,
        payload: result.payload as QdrantPoint['payload'],
      }));
    } catch (error) {
      console.error('[Qdrant] Search failed:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors (simplified API for chat)
   */
  async searchSimilar(
    queryVector: number[],
    topK: number = 5,
    minScore: number = 0.5
  ): Promise<QdrantSearchResult[]> {
    return this.search(queryVector, { topK, minScore });
  }

  /**
   * Delete a point by ID
   */
  async deletePoint(pointId: string): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [pointId],
      });

      console.log(`[Qdrant] Deleted point: ${pointId}`);
    } catch (error) {
      console.error(`[Qdrant] Failed to delete point ${pointId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all points for a document
   */
  async deleteDocumentPoints(documentId: string): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId,
              },
            },
          ],
        },
      });

      console.log(`[Qdrant] Deleted all points for document: ${documentId}`);
    } catch (error) {
      console.error(`[Qdrant] Failed to delete document points:`, error);
      throw error;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error) {
      console.error('[Qdrant] Failed to get collection info:', error);
      throw error;
    }
  }

  /**
   * Get point by ID
   */
  async getPoint(pointId: string): Promise<QdrantPoint | null> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      const points = await this.client.retrieve(this.collectionName, {
        ids: [pointId],
      });

      if (points.length === 0) return null;

      const point = points[0];
      return {
        id: String(point.id),
        vector: point.vector as number[],
        payload: point.payload as QdrantPoint['payload'],
      };
    } catch (error) {
      console.error(`[Qdrant] Failed to get point ${pointId}:`, error);
      return null;
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }
}

// Export singleton instance
export const qdrantService = new QdrantService();
