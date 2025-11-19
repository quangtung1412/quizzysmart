/**
 * RAG Router Service
 * 
 * Routes RAG requests between Qdrant and Google File Search based on system settings
 */

import { PrismaClient } from '@prisma/client';
import type {
    DocumentMetadata,
    RAGQuery,
    RAGResponse,
    RetrievedChunk,
} from '../types/rag.types.js';
import { geminiRAGService } from './gemini-rag.service.js';
import { qdrantService } from './qdrant.service.js';
import { geminiFileSearchService } from './gemini-file-search.service.js';

const prisma = new PrismaClient();

type RAGMethod = 'qdrant' | 'google-file-search';

interface RAGConfig {
    method: RAGMethod;
    fileSearchStoreName?: string;
}

class RAGRouterService {
    /**
     * Get current RAG configuration from system settings
     */
    async getRAGConfig(): Promise<RAGConfig> {
        try {
            const systemSettings = await (prisma as any).systemSettings.findFirst();

            if (!systemSettings) {
                // Default to Qdrant if no settings found
                console.log('[RAG Router] No system settings found, defaulting to Qdrant');
                return { method: 'qdrant' };
            }

            const method = systemSettings.ragMethod as RAGMethod;
            const fileSearchStoreName = systemSettings.fileSearchStoreName;

            console.log(`[RAG Router] Current method: ${method}${fileSearchStoreName ? ` (store: ${fileSearchStoreName})` : ''}`);

            return {
                method,
                fileSearchStoreName: method === 'google-file-search' ? fileSearchStoreName : undefined,
            };
        } catch (error) {
            console.error('[RAG Router] Failed to get RAG config:', error);
            return { method: 'qdrant' }; // Fallback to Qdrant
        }
    }

    /**
     * Set RAG configuration
     */
    async setRAGConfig(method: RAGMethod, fileSearchStoreName?: string): Promise<void> {
        try {
            // Validate configuration
            if (method === 'google-file-search') {
                if (!fileSearchStoreName) {
                    throw new Error('File Search store name is required for google-file-search method');
                }

                // Verify store exists
                const store = await geminiFileSearchService.getFileSearchStore(fileSearchStoreName);
                if (!store) {
                    throw new Error(`File Search store "${fileSearchStoreName}" does not exist`);
                }
            }

            // Update or create system settings
            const existingSettings = await (prisma as any).systemSettings.findFirst();

            if (existingSettings) {
                await (prisma as any).systemSettings.update({
                    where: { id: existingSettings.id },
                    data: {
                        ragMethod: method,
                        fileSearchStoreName: method === 'google-file-search' ? fileSearchStoreName : null,
                    },
                });
            } else {
                await (prisma as any).systemSettings.create({
                    data: {
                        ragMethod: method,
                        fileSearchStoreName: method === 'google-file-search' ? fileSearchStoreName : null,
                    },
                });
            }

            console.log(`[RAG Router] Configuration updated to: ${method}`);
        } catch (error) {
            console.error('[RAG Router] Failed to set RAG config:', error);
            throw error;
        }
    }

    /**
     * Process query using the configured RAG method
     */
    async processQuery(query: RAGQuery): Promise<RAGResponse> {
        const config = await this.getRAGConfig();

        if (config.method === 'google-file-search') {
            return this.processQueryWithFileSearch(query, config.fileSearchStoreName!);
        } else {
            return this.processQueryWithQdrant(query);
        }
    }

    /**
     * Process query using the configured RAG method with streaming
     */
    async *processQueryStream(query: RAGQuery): AsyncGenerator<{ chunk: string; done: boolean; metadata?: any }> {
        const config = await this.getRAGConfig();

        if (config.method === 'google-file-search') {
            yield* this.processQueryWithFileSearchStream(query, config.fileSearchStoreName!);
        } else {
            yield* this.processQueryWithQdrantStream(query);
        }
    }

    /**
     * Process query with Qdrant (existing implementation)
     */
    private async processQueryWithQdrant(query: RAGQuery): Promise<RAGResponse> {
        console.log('[RAG Router] Processing with Qdrant');

        // Generate embedding
        const questionEmbedding = await geminiRAGService.generateEmbedding(query.question);

        // Search in Qdrant
        const topK = query.topK || 12;
        const searchResults = await qdrantService.searchSimilar(questionEmbedding, topK, 0.5);

        console.log(`[RAG Router] Found ${searchResults.length} chunks in Qdrant`);

        if (searchResults.length === 0) {
            return {
                answer: 'Xin lỗi, tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn.',
                sources: [],
                model: 'N/A',
                confidence: 0,
                tokenUsage: { input: 0, output: 0, total: 0 },
            };
        }

        // Prepare retrieved chunks
        const retrievedChunks: RetrievedChunk[] = searchResults.map((result: any) => ({
            chunkId: result.id,
            content: result.payload.content,
            documentId: result.payload.documentId,
            documentName: result.payload.documentName,
            documentNumber: result.payload.documentNumber,
            score: result.score,
            metadata: result.payload,
        }));

        // Generate answer using Gemini
        return geminiRAGService.generateRAGAnswer(query, retrievedChunks);
    }

    /**
     * Process query with Qdrant streaming
     */
    private async *processQueryWithQdrantStream(query: RAGQuery): AsyncGenerator<{ chunk: string; done: boolean; metadata?: any }> {
        console.log('[RAG Router] Processing with Qdrant (streaming)');

        // Generate embedding
        const questionEmbedding = await geminiRAGService.generateEmbedding(query.question);

        // Search in Qdrant
        const topK = query.topK || 12;
        const searchResults = await qdrantService.searchSimilar(questionEmbedding, topK, 0.5);

        console.log(`[RAG Router] Found ${searchResults.length} chunks in Qdrant`);

        if (searchResults.length === 0) {
            yield {
                chunk: '',
                done: true,
                metadata: {
                    answer: 'Xin lỗi, tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn.',
                    sources: [],
                    model: 'N/A',
                    confidence: 0,
                }
            };
            return;
        }

        // Prepare retrieved chunks
        const retrievedChunks: RetrievedChunk[] = searchResults.map((result: any) => ({
            chunkId: result.id,
            content: result.payload.content,
            documentId: result.payload.documentId,
            documentName: result.payload.documentName,
            documentNumber: result.payload.documentNumber,
            score: result.score,
            metadata: result.payload,
        }));

        // Stream answer using Gemini
        yield* geminiRAGService.generateRAGAnswerStream(query, retrievedChunks);
    }

    /**
     * Process query with Google File Search
     */
    private async processQueryWithFileSearch(query: RAGQuery, storeName: string): Promise<RAGResponse> {
        console.log(`[RAG Router] Processing with Google File Search (store: ${storeName})`);

        // Use Google File Search directly
        return geminiFileSearchService.generateRAGAnswer(query, [storeName]);
    }

    /**
     * Process query with Google File Search streaming
     */
    private async *processQueryWithFileSearchStream(query: RAGQuery, storeName: string): AsyncGenerator<{ chunk: string; done: boolean; metadata?: any }> {
        console.log(`[RAG Router] Processing with Google File Search streaming (store: ${storeName})`);

        // Stream answer using Google File Search
        yield* geminiFileSearchService.generateRAGAnswerStream(query, [storeName]);
    }

    /**
     * Get statistics for current RAG method
     */
    async getRAGStats(): Promise<any> {
        const config = await this.getRAGConfig();

        if (config.method === 'google-file-search') {
            // Get File Search stats
            const stores = await geminiFileSearchService.listFileSearchStores();
            return {
                method: 'google-file-search',
                stores: stores.length,
                currentStore: config.fileSearchStoreName,
            };
        } else {
            // Get Qdrant stats
            const collections = await qdrantService.listCollections();
            const totalPoints = collections.reduce((sum, col) => sum + (col.pointsCount || 0), 0);

            return {
                method: 'qdrant',
                collections: collections.length,
                totalPoints: totalPoints,
                collectionDetails: collections.map(col => ({
                    name: col.name,
                    points: col.pointsCount,
                })),
            };
        }
    }
}

export const ragRouterService = new RAGRouterService();
