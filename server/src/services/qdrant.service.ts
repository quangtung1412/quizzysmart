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
  async upsertPoint(point: QdrantPoint, collectionName?: string): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    const targetCollection = collectionName || this.collectionName;

    try {
      await this.client.upsert(targetCollection, {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector,
            payload: point.payload,
          },
        ],
      });

      console.log(`[Qdrant] Upserted point: ${point.id} to collection: ${targetCollection}`);
    } catch (error) {
      console.error(`[Qdrant] Failed to upsert point ${point.id}:`, error);
      throw error;
    }
  }

  /**
   * Upsert multiple vector points (batch)
   */
  async upsertPoints(points: QdrantPoint[], collectionName?: string): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');
    if (points.length === 0) return;

    const targetCollection = collectionName || this.collectionName;

    try {
      await this.client.upsert(targetCollection, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });

      console.log(`[Qdrant] Upserted ${points.length} points to collection: ${targetCollection}`);
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
      excludeKeywords?: string[]; // NEW: Keywords to exclude from document names
      requireKeywords?: string[]; // NEW: Keywords that must be in document names
      collectionName?: string; // NEW: Specify collection to search in
    } = {}
  ): Promise<QdrantSearchResult[]> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    const { topK = 5, minScore = 0.5, documentIds, chunkTypes, excludeKeywords, requireKeywords, collectionName } = options;
    const targetCollection = collectionName || this.collectionName;

    try {
      // Build filter
      const filter: any = {
        must: [],
        must_not: [], // NEW: For exclusions
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

      // NEW: Require specific keywords in document name
      if (requireKeywords && requireKeywords.length > 0) {
        requireKeywords.forEach(keyword => {
          filter.must.push({
            key: 'documentName',
            match: {
              text: keyword,
            },
          });
        });
      }

      // NEW: Exclude documents with specific keywords
      if (excludeKeywords && excludeKeywords.length > 0) {
        excludeKeywords.forEach(keyword => {
          filter.must_not.push({
            key: 'documentName',
            match: {
              text: keyword,
            },
          });
        });
      }

      const searchParams: any = {
        vector: queryVector,
        limit: topK,
        score_threshold: minScore,
      };

      // Only add filter if we have conditions
      if (filter.must.length > 0 || filter.must_not.length > 0) {
        searchParams.filter = filter;
      }

      const results = await this.client.search(targetCollection, searchParams);

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
   * 1. Original vector similarity score (base)
   * 2. Keyword matching bonus (additive)
   * 3. Position penalty (slight preference for earlier results)
   * 4. Document diversity filtering (not affecting score)
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
      keywordWeight = 0.1, // Reduced from 0.2, now it's a BONUS not a replacement
      maxPerDocument = 5,
    } = options;

    // Normalize query for keyword matching
    const queryLower = query.toLowerCase();
    const queryKeywords = queryLower
      .split(/\s+/)
      .filter((w) => w.length > 2); // Filter short words

    // Calculate scores for each result
    const scoredResults = results.map((result, index) => {
      // 1. Original vector score (keep full value as base)
      const vectorScore = result.score;

      // 2. Document name matching bonus (VERY HIGH priority for exact match)
      const documentName = result.payload.documentName?.toLowerCase() || '';
      let docNameBonus = 0;
      let hasAnyKeywordMatch = false;
      
      queryKeywords.forEach((keyword) => {
        if (documentName.includes(keyword)) {
          docNameBonus += 0.25; // INCREASED from 0.15 to 0.25
          hasAnyKeywordMatch = true;
        }
      });
      
      // Cap document name bonus at 0.5 (INCREASED from 0.3)
      docNameBonus = Math.min(docNameBonus, 0.5);
      
      // Apply penalty for documents with NO keyword match (push them down)
      const noMatchPenalty = !hasAnyKeywordMatch ? -0.2 : 0;

      // 3. Content keyword matching bonus (additive, not replacement)
      const content = result.payload.content?.toLowerCase() || '';
      const articleTitle = result.payload.articleTitle?.toLowerCase() || '';
      const chapterTitle = result.payload.chapterTitle?.toLowerCase() || '';

      let keywordMatches = 0;
      queryKeywords.forEach((keyword) => {
        if (content.includes(keyword)) keywordMatches += 1;
        if (articleTitle.includes(keyword)) keywordMatches += 2; // Title matches are more important
        if (chapterTitle.includes(keyword)) keywordMatches += 1.5;
      });

      const keywordBonus = Math.min(keywordMatches / (queryKeywords.length * 2), 1.0) * keywordWeight;

      // 4. Position penalty (prefer earlier results slightly)
      const positionPenalty = 1 - (index / results.length) * 0.05; // Reduced from 0.1

      // Combined score: Keep vector score intact and ADD bonuses/penalties
      const baseScore = vectorScore + docNameBonus + keywordBonus + noMatchPenalty;

      return {
        ...result,
        rerankScore: baseScore * positionPenalty,
        docNameBonus,
        keywordBonus,
        noMatchPenalty,
        originalIndex: index,
      };
    });

    // Sort by rerank score
    scoredResults.sort((a, b) => b.rerankScore - a.rerankScore);

    // Apply diversity filtering (doesn't change scores, just filters)
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
        if (result.rerankScore < 0.75) continue; // Increased threshold from 0.7
      }

      diverseResults.push(result);
      articlesSeen.add(articleKey);
      documentCounts.set(docId, docCount + 1);
    }

    console.log(`[Qdrant] Reranked ${results.length} → ${diverseResults.length} diverse results`);

    // Return without the extra metadata
    return diverseResults.map(({ rerankScore, docNameBonus, keywordBonus, originalIndex, ...rest }) => ({
      ...rest,
      score: rerankScore, // Use reranked score (but now it preserves more of original)
    }));
  }

  // ============================================================================
  // COLLECTION MANAGEMENT METHODS
  // ============================================================================

  /**
   * List all collections in Qdrant
   */
  async listCollections(): Promise<Array<{
    name: string;
    vectorsCount?: number;
    pointsCount?: number;
    status?: string;
  }>> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      const response = await this.client.getCollections();
      
      // Get detailed info for each collection
      const collectionsWithDetails = await Promise.all(
        response.collections.map(async (col) => {
          try {
            const info = await this.client!.getCollection(col.name);
            return {
              name: col.name,
              vectorsCount: info.vectors_count || 0,
              pointsCount: info.points_count || 0,
              status: info.status || 'unknown',
            };
          } catch (error) {
            console.warn(`Failed to get info for collection ${col.name}:`, error);
            return {
              name: col.name,
              vectorsCount: 0,
              pointsCount: 0,
              status: 'unknown',
            };
          }
        })
      );

      return collectionsWithDetails;
    } catch (error) {
      console.error('[Qdrant] Failed to list collections:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific collection
   */
  async getCollectionInfo(collectionName: string): Promise<{
    name: string;
    vectorsCount: number;
    pointsCount: number;
    status: string;
    config: any;
  }> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      const info = await this.client.getCollection(collectionName);
      
      return {
        name: collectionName,
        vectorsCount: info.vectors_count || 0,
        pointsCount: info.points_count || 0,
        status: info.status || 'unknown',
        config: info.config,
      };
    } catch (error) {
      console.error(`[Qdrant] Failed to get collection info for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(
    collectionName: string,
    options?: {
      vectorSize?: number;
      distance?: 'Cosine' | 'Euclid' | 'Dot';
      description?: string;
    }
  ): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    const { vectorSize = this.vectorDimension, distance = 'Cosine', description } = options || {};

    try {
      // Check if collection already exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === collectionName);

      if (exists) {
        throw new Error(`Collection "${collectionName}" already exists`);
      }

      // Create collection
      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance,
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 2,
      });

      // Create payload indexes for faster filtering
      const indexFields = [
        'documentId',
        'documentNumber',
        'chunkType',
        'articleNumber',
      ];

      for (const field of indexFields) {
        try {
          await this.client.createPayloadIndex(collectionName, {
            field_name: field,
            field_schema: 'keyword',
          });
        } catch (error) {
          console.warn(`Failed to create index for field ${field}:`, error);
        }
      }

      console.log(`[Qdrant] Collection "${collectionName}" created successfully`);
    } catch (error) {
      console.error(`[Qdrant] Failed to create collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      // Prevent deletion of default collection
      if (collectionName === this.collectionName) {
        throw new Error('Cannot delete the default collection');
      }

      await this.client.deleteCollection(collectionName);
      console.log(`[Qdrant] Collection "${collectionName}" deleted successfully`);
    } catch (error) {
      console.error(`[Qdrant] Failed to delete collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      const collections = await this.client.getCollections();
      return collections.collections.some((c) => c.name === collectionName);
    } catch (error) {
      console.error('[Qdrant] Failed to check collection existence:', error);
      return false;
    }
  }

  /**
   * Search across multiple collections
   */
  async searchMultipleCollections(
    queryVector: number[],
    collectionNames: string[],
    options: {
      topK?: number;
      minScore?: number;
      documentIds?: string[];
      chunkTypes?: string[];
    } = {}
  ): Promise<QdrantSearchResult[]> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    try {
      // Search in each collection in parallel
      const searchPromises = collectionNames.map(async (collectionName) => {
        try {
          const results = await this.search(queryVector, {
            ...options,
            collectionName,
          });
          // Add collection name to metadata
          return results.map(r => ({
            ...r,
            payload: {
              ...r.payload,
              _collectionName: collectionName,
            },
          }));
        } catch (error) {
          console.warn(`Failed to search in collection ${collectionName}:`, error);
          return [];
        }
      });

      const allResults = await Promise.all(searchPromises);
      
      // Merge and sort by score
      const mergedResults = allResults.flat().sort((a, b) => b.score - a.score);
      
      // Return top K results
      const topK = options.topK || 5;
      return mergedResults.slice(0, topK);
    } catch (error) {
      console.error('[Qdrant] Multi-collection search failed:', error);
      throw error;
    }
  }

  /**
   * Search across initial collections, and if results are not satisfying, fall back to the "common" collection.
   */
  async searchWithFallback(
    queryVector: number[],
    initialCollections: string[],
    options: {
      topK?: number;
      minScore?: number;
      satisfyingThreshold?: number;
      commonCollectionName?: string;
      documentIds?: string[];
      chunkTypes?: string[];
      onFallbackTriggered?: () => void;
    } = {}
  ): Promise<QdrantSearchResult[]> {
    if (!this.client) throw new Error('Qdrant client not initialized');

    const {
      topK = 5,
      minScore = 0.5,
      satisfyingThreshold = 0.55,
      commonCollectionName = 'common',
      documentIds,
      chunkTypes,
      onFallbackTriggered,
    } = options;

    console.log(`[Qdrant Fallback Search] Initial collections checklist:`, initialCollections);

    // Filter list of available collections in Qdrant to ensure we only search existing ones
    let availableCollections: string[] = [];
    try {
      const qdrantCollections = await this.listCollections();
      availableCollections = qdrantCollections.map(c => c.name);
    } catch (err) {
      console.warn('[Qdrant Fallback Search] Failed to list collections, using provided names as fallback:', err);
      availableCollections = initialCollections;
    }

    // Filter target collections: must exist in Qdrant and must NOT be 'common'
    let initialTargets = initialCollections.filter(
      c => availableCollections.includes(c) && c !== commonCollectionName
    );

    // If no initial target collections exist, search in all available collections except "common"
    if (initialTargets.length === 0) {
      console.log(`[Qdrant Fallback Search] No valid business collections specified. Searching in all except "common"`);
      initialTargets = availableCollections.filter(c => c !== commonCollectionName);
    }

    // If there's still nothing or only common exists, search common directly
    if (initialTargets.length === 0) {
      console.log(`[Qdrant Fallback Search] Only "common" or no collections exist. Searching in all available.`);
      initialTargets = availableCollections;
    }

    console.log(`[Qdrant Fallback Search] Searching in initial business collections:`, initialTargets);

    let results: QdrantSearchResult[] = [];
    try {
      if (initialTargets.length > 1) {
        results = await this.searchMultipleCollections(queryVector, initialTargets, { topK, minScore, documentIds, chunkTypes });
      } else if (initialTargets.length === 1) {
        results = await this.search(queryVector, { topK, minScore, documentIds, chunkTypes, collectionName: initialTargets[0] });
      }
    } catch (err) {
      console.error(`[Qdrant Fallback Search] Search in initial collections ${initialTargets.join(', ')} failed:`, err);
    }

    // Determine if results are satisfying: not empty AND max score >= satisfyingThreshold
    const maxScore = results.length > 0 ? results[0].score : 0;
    const isSatisfying = results.length > 0 && maxScore >= satisfyingThreshold;

    console.log(`[Qdrant Fallback Search] Initial search returned ${results.length} results. Max score: ${maxScore.toFixed(4)}. Satisfying: ${isSatisfying}`);

    // If results are not satisfying, search in "common"
    const hasCommonCollection = availableCollections.some(c => c === commonCollectionName);
    const alreadySearchedCommon = initialTargets.includes(commonCollectionName);

    if (!isSatisfying && hasCommonCollection && !alreadySearchedCommon) {
      console.log(`[Qdrant Fallback Search] Fallback triggered! Searching in "${commonCollectionName}" collection...`);
      if (onFallbackTriggered) {
        onFallbackTriggered();
      }

      try {
        const commonResults = await this.search(queryVector, {
          topK,
          minScore,
          documentIds,
          chunkTypes,
          collectionName: commonCollectionName
        });

        console.log(`[Qdrant Fallback Search] Found ${commonResults.length} docs in "${commonCollectionName}"`);

        // Merge results: keep the highest score for any duplicate points, then sort and slice to topK
        const mergedMap = new Map<string, QdrantSearchResult>();
        
        // Add business results
        results.forEach(r => {
          mergedMap.set(r.id, r);
        });

        // Add / Override with common results if score is better or not exists
        commonResults.forEach(cr => {
          const existing = mergedMap.get(cr.id);
          if (!existing || existing.score < cr.score) {
            // Tag with collection so Reranking or other parts know where it came from
            const tagged = {
              ...cr,
              payload: {
                ...cr.payload,
                _collectionName: commonCollectionName
              }
            };
            mergedMap.set(cr.id, tagged);
          }
        });

        results = Array.from(mergedMap.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);

        console.log(`[Qdrant Fallback Search] Merged results count: ${results.length}`);
      } catch (err) {
        console.error(`[Qdrant Fallback Search] Search in common collection failed:`, err);
      }
    }

    return results;
  }
}

// Export singleton instance
export const qdrantService = new QdrantService();
