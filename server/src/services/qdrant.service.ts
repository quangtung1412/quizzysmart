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
    minScore: number = 0.7  // Lowered from 0.5 to get more diverse results
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

  /**
   * Rerank search results for diversity and relevance
   * 
   * Scoring factors:
   * 1. Original vector similarity score (60%)
   * 2. Keyword matching with query (20%)
   * 3. Document diversity penalty (10%)
   * 4. Article diversity penalty (10%)
   */
  rerankResults(
    results: QdrantSearchResult[],
    query: string,
    options: {
      diversityWeight?: number;
      keywordWeight?: number;
      maxPerDocument?: number;
    } = {}
  ): QdrantSearchResult[] {
    if (results.length === 0) return results;

    const {
      diversityWeight = 0.2,
      keywordWeight = 0.2,
      maxPerDocument = 5,
    } = options;

    // Normalize query for keyword matching
    const queryLower = query.toLowerCase();
    const queryKeywords = queryLower
      .split(/\s+/)
      .filter((w) => w.length > 2); // Filter short words

    // Calculate scores for each result
    const scoredResults = results.map((result, index) => {
      // 1. Original vector score (already 0-1)
      const vectorScore = result.score;

      // 2. Keyword matching score
      const content = result.payload.content?.toLowerCase() || '';
      const articleTitle = result.payload.articleTitle?.toLowerCase() || '';
      const chapterTitle = result.payload.chapterTitle?.toLowerCase() || '';

      let keywordMatches = 0;
      queryKeywords.forEach((keyword) => {
        if (content.includes(keyword)) keywordMatches += 1;
        if (articleTitle.includes(keyword)) keywordMatches += 2; // Title matches are more important
        if (chapterTitle.includes(keyword)) keywordMatches += 1.5;
      });

      const keywordScore = Math.min(keywordMatches / (queryKeywords.length * 2), 1.0);

      // 3. Position penalty (prefer earlier results slightly)
      const positionPenalty = 1 - (index / results.length) * 0.1;

      // Combined score
      const baseScore =
        vectorScore * (1 - keywordWeight - diversityWeight) +
        keywordScore * keywordWeight;

      return {
        ...result,
        rerankScore: baseScore * positionPenalty,
        keywordScore,
        originalIndex: index,
      };
    });

    // Sort by rerank score
    scoredResults.sort((a, b) => b.rerankScore - a.rerankScore);

    // Apply diversity filtering
    const diverseResults: typeof scoredResults = [];
    const documentCounts = new Map<string, number>();
    const articlesSeen = new Set<string>();

    for (const result of scoredResults) {
      const docId = result.payload.documentId;
      const articleKey = `${docId}_${result.payload.articleNumber}`;

      // Skip if we've seen this exact article
      if (articlesSeen.has(articleKey)) continue;

      // Check document quota
      const docCount = documentCounts.get(docId) || 0;
      if (docCount >= maxPerDocument) {
        // Apply diversity penalty but still consider if score is high enough
        if (result.rerankScore < 0.7) continue;
      }

      diverseResults.push(result);
      articlesSeen.add(articleKey);
      documentCounts.set(docId, docCount + 1);
    }

    console.log(`[Qdrant] Reranked ${results.length} → ${diverseResults.length} diverse results`);

    // Return without the extra metadata
    return diverseResults.map(({ rerankScore, keywordScore, originalIndex, ...rest }) => ({
      ...rest,
      score: rerankScore, // Replace with reranked score
    }));
  }
}

// Export singleton instance
export const qdrantService = new QdrantService();
