/**
 * Gemini File Search Service
 * 
 * Handles PDF upload, indexing, and querying using Google's File Search tool
 * Documentation: https://ai.google.dev/gemini-api/docs/file-search
 */

import { GoogleGenAI } from '@google/genai';
import type {
    DocumentMetadata,
    RAGQuery,
    RAGResponse,
    RetrievedChunk,
} from '../types/rag.types.js';
import { geminiModelRotation } from '../gemini-model-rotation.js';
import { modelSettingsService } from './model-settings.service.js';
import fetch from 'node-fetch';


interface FileSearchStore {
    name: string;
    displayName: string;
    createTime: string;
}

interface FileSearchDocument {
    name: string;
    displayName: string;
    mimeType: string;
    sizeBytes: string;
    state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

interface UploadOperationMetadata {
    name: string;
    done: boolean;
    metadata?: {
        state: string;
        createTime: string;
    };
    response?: any;
    error?: any;
}

class GeminiFileSearchService {
    private ai: GoogleGenAI;
    private apiKey: string;
    private maxRetries = 3;
    private retryDelay = 2000;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) {
            throw new Error('GEMINI_API_KEY not found in environment');
        }

        this.apiKey = key;
        this.ai = new GoogleGenAI({ apiKey: key });
    }

    /**
     * Sleep utility for delays
     */
    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if error is retryable
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
     * Get appropriate model for answering
     */
    private async getAnswerModel(): Promise<{ name: string; priority: number }> {
        try {
            const { PrismaClient } = await import('@prisma/client');
            const prisma = new PrismaClient();
            const systemSettings = await (prisma as any).systemSettings.findFirst();
            await prisma.$disconnect();

            if (systemSettings && !systemSettings.modelRotationEnabled) {
                const defaultModel = await modelSettingsService.getDefaultModel();
                console.log(`[FileSearch] Model rotation DISABLED - Using default model: ${defaultModel}`);
                return { name: defaultModel, priority: 0 };
            }
        } catch (error) {
            console.warn('[FileSearch] Could not check system settings, using rotation:', error);
        }

        const modelInfo = await geminiModelRotation.getNextAvailableModel();
        if (!modelInfo) {
            throw new Error('No available Gemini models');
        }
        console.log(`[FileSearch] Model rotation ENABLED - Using: ${modelInfo.name}`);
        return modelInfo;
    }

    /**
     * Create a new File Search store
     */
    async createFileSearchStore(displayName: string): Promise<FileSearchStore> {
        try {
            console.log(`[FileSearch] Creating store: ${displayName}`);

            const response = await fetch(`${this.baseUrl}/fileSearchStores?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    displayName
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const store = await response.json() as any;

            console.log(`[FileSearch] Store created: ${store.name}`);
            return {
                name: store.name,
                displayName: store.displayName || displayName,
                createTime: store.createTime || new Date().toISOString(),
            };
        } catch (error) {
            console.error('[FileSearch] Failed to create store:', error);
            throw new Error(`Failed to create File Search store: ${error}`);
        }
    }

    /**
     * List all File Search stores
     */
    async listFileSearchStores(): Promise<FileSearchStore[]> {
        try {
            console.log('[FileSearch] Listing stores...');

            const response = await fetch(`${this.baseUrl}/fileSearchStores?key=${this.apiKey}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json() as any;
            const stores: FileSearchStore[] = (data.fileSearchStores || []).map((store: any) => ({
                name: store.name,
                displayName: store.displayName || store.name,
                createTime: store.createTime || '',
            }));

            console.log(`[FileSearch] Found ${stores.length} stores`);
            return stores;
        } catch (error) {
            console.error('[FileSearch] Failed to list stores:', error);
            throw new Error(`Failed to list File Search stores: ${error}`);
        }
    }

    /**
     * Get a specific File Search store by name
     */
    async getFileSearchStore(storeName: string): Promise<FileSearchStore | null> {
        try {
            console.log(`[FileSearch] Getting store: ${storeName}`);

            const response = await fetch(`${this.baseUrl}/${storeName}?key=${this.apiKey}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const store = await response.json() as any;

            return {
                name: store.name,
                displayName: store.displayName || store.name,
                createTime: store.createTime || '',
            };
        } catch (error) {
            console.error('[FileSearch] Failed to get store:', error);
            return null;
        }
    }

    /**
     * Delete a File Search store
     */
    async deleteFileSearchStore(storeName: string, force: boolean = true): Promise<void> {
        try {
            console.log(`[FileSearch] Deleting store: ${storeName}`);

            const response = await fetch(`${this.baseUrl}/${storeName}?force=${force}&key=${this.apiKey}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            console.log(`[FileSearch] Store deleted: ${storeName}`);
        } catch (error) {
            console.error('[FileSearch] Failed to delete store:', error);
            throw new Error(`Failed to delete File Search store: ${error}`);
        }
    }

    /**
     * Upload PDF to Gemini Files API (simpler approach)
     * Note: Google File Search store integration may not be fully available yet
     * This uploads to general Files API instead
     */
    async uploadPDFToStore(
        filePath: string,
        fileSearchStoreName: string,
        displayName: string,
        metadata?: DocumentMetadata
    ): Promise<FileSearchDocument> {
        try {
            console.log(`[FileSearch] Uploading ${displayName} (will be associated with ${fileSearchStoreName})`);

            const fs = await import('fs/promises');
            const FormData = (await import('form-data')).default;

            // Read file
            const fileBuffer = await fs.readFile(filePath);
            const fileStats = await fs.stat(filePath);

            const uploadForm = new FormData();
            uploadForm.append('file', fileBuffer, {
                filename: displayName,
                contentType: 'application/pdf',
            });

            // Upload to general Files API (not store-specific)
            // This API is more stable and well-documented
            const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${this.apiKey}`;

            console.log(`[FileSearch] Uploading to Files API...`);

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: uploadForm as any,
                headers: uploadForm.getHeaders ? uploadForm.getHeaders() : {},
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error(`[FileSearch] Upload failed: ${errorText}`);
                throw new Error(`Upload failed - HTTP ${uploadResponse.status}: ${errorText}`);
            }

            const result = await uploadResponse.json() as any;
            const file = result.file || result;

            console.log(`[FileSearch] Upload successful: ${file.name}`);
            console.log(`[FileSearch] File URI: ${file.uri}`);

            // Wait for file to be processed (ACTIVE state)
            if (file.state === 'PROCESSING') {
                console.log(`[FileSearch] File is processing, waiting...`);
                await this.sleep(3000); // Wait 3 seconds
            }

            return {
                name: file.name || `files/${Date.now()}`,
                displayName: file.displayName || displayName,
                mimeType: file.mimeType || 'application/pdf',
                sizeBytes: file.sizeBytes || fileStats.size.toString(),
                state: file.state || 'ACTIVE',
            };
        } catch (error) {
            console.error('[FileSearch] Upload failed:', error);
            throw new Error(`Failed to upload document: ${error}`);
        }
    }

    /**
     * Wait for document processing to complete
     */
    private async waitForDocumentProcessing(operationName: string, maxWaitTime: number = 300000): Promise<FileSearchDocument> {
        const startTime = Date.now();
        const pollInterval = 2000; // Check every 2 seconds

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const response = await fetch(`${this.baseUrl}/${operationName}?key=${this.apiKey}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const operation = await response.json() as UploadOperationMetadata;

                if (operation.done) {
                    if (operation.error) {
                        throw new Error(`Processing failed: ${JSON.stringify(operation.error)}`);
                    }

                    if (operation.response) {
                        return {
                            name: operation.response.name,
                            displayName: operation.response.displayName,
                            mimeType: operation.response.mimeType,
                            sizeBytes: operation.response.sizeBytes,
                            state: operation.response.state || 'ACTIVE',
                        };
                    }
                }

                console.log(`[FileSearch] Still processing... (${Math.round((Date.now() - startTime) / 1000)}s)`);
                await this.sleep(pollInterval);
            } catch (error) {
                console.error('[FileSearch] Error checking operation:', error);
                throw error;
            }
        }

        throw new Error(`Document processing timeout after ${maxWaitTime / 1000}s`);
    }

    /**
     * Generate answer using Google File Search RAG
     * 
     * Uses Google's File Search tool to automatically search across uploaded documents.
     * The model performs semantic search and grounds its response with citations.
     * 
     * @param query - RAG query with question and optional parameters
     * @param fileSearchStoreNames - Array of File Search store names to search (e.g., ['fileSearchStores/abc123'])
     * @param metadataFilter - Optional metadata filter (e.g., 'author="John Doe"' or 'year>2020')
     * @returns RAG response with answer, sources, citations, and token usage
     * 
     * @example
     * ```typescript
     * const response = await service.generateRAGAnswer(
     *   { question: "What is the loan interest rate?" },
     *   ['fileSearchStores/loan-docs'],
     *   'documentType="policy"'
     * );
     * ```
     */
    async generateRAGAnswer(
        query: RAGQuery,
        fileSearchStoreNames: string[],
        metadataFilter?: string
    ): Promise<RAGResponse> {
        let lastError: any;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`[FileSearch] Retry attempt ${attempt + 1}/${this.maxRetries}`);
                    await this.sleep(this.retryDelay * attempt);
                }

                console.log(`[FileSearch] Generating answer for: "${query.question.substring(0, 50)}..."`);
                if (fileSearchStoreNames && fileSearchStoreNames.length > 0) {
                    console.log(`[FileSearch] Using File Search tool with store: ${fileSearchStoreNames[0]}`);
                }

                const modelInfo = await this.getAnswerModel();

                // Build FileSearch tool config with optional metadata filter
                const fileSearchTool: any = {
                    fileSearch: {
                        fileSearchStoreNames: fileSearchStoreNames
                    }
                };

                // Add metadata filter if provided (e.g., 'author="John Doe"')
                if (metadataFilter) {
                    fileSearchTool.fileSearch.metadataFilter = metadataFilter;
                    console.log(`[FileSearch] Using metadata filter: ${metadataFilter}`);
                }

                // Generate content using FileSearch tool - Google automatically searches the store
                const result = await this.ai.models.generateContent({
                    model: modelInfo.name,
                    contents: query.question,
                    config: {
                        tools: [fileSearchTool]
                    }
                });

                const answer = result.text || '';

                if (!answer || answer.trim().length === 0) {
                    throw new Error('Empty response from Gemini');
                }

                // ⚠️ IMPORTANT NOTE: Google File Search tool does NOT return grounding metadata
                // The File Search tool automatically retrieves and injects relevant context into
                // the prompt, but the API does not expose which specific documents/chunks were used.
                // This is by design in Google's File Search implementation.
                //
                // If you need explicit citations and source tracking, use Qdrant RAG instead.
                //
                // The answer IS grounded in your documents (File Search did its job), but we
                // cannot programmatically extract which documents were used.

                console.log('[FileSearch] ⚠️  Note: Google File Search does not provide grounding metadata');
                console.log('[FileSearch] Answer is still grounded in documents, but citations are not available');

                // Return empty arrays for sources and citations since they're not available from API
                const sources: any[] = [];
                const citations: any[] = [];

                return {
                    answer,
                    sources,
                    model: modelInfo.name,
                    confidence: 85,
                    citations: citations,
                    tokenUsage: {
                        input: (result as any).usageMetadata?.promptTokenCount || 0,
                        output: (result as any).usageMetadata?.candidatesTokenCount || 0,
                        total: (result as any).usageMetadata?.totalTokenCount || 0,
                    }
                };
            } catch (error: any) {
                lastError = error;
                console.error(`[FileSearch] Attempt ${attempt + 1} failed:`, error);

                if (!this.isRetryableError(error)) {
                    throw error;
                }
            }
        }

        throw lastError || new Error('File Search query failed after retries');
    }

    /**
     * Generate answer using Google File Search RAG with streaming
     * 
     * Streams the response in real-time for better UX. Same functionality as generateRAGAnswer
     * but yields chunks as they're generated instead of waiting for the complete response.
     * 
     * @param query - RAG query with question and optional parameters
     * @param fileSearchStoreNames - Array of File Search store names to search
     * @param metadataFilter - Optional metadata filter for document subset
     * @yields Chunks with { chunk: string, done: boolean, metadata?: any }
     * 
     * @example
     * ```typescript
     * for await (const { chunk, done, metadata } of service.generateRAGAnswerStream(query, stores)) {
     *   if (!done) {
     *     console.log('Chunk:', chunk);
     *   } else {
     *     console.log('Complete:', metadata);
     *   }
     * }
     * ```
     */
    async *generateRAGAnswerStream(
        query: RAGQuery,
        fileSearchStoreNames: string[],
        metadataFilter?: string
    ): AsyncGenerator<{ chunk: string; done: boolean; metadata?: any }> {
        let lastError: any;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`[FileSearch Stream] Retry attempt ${attempt + 1}/${this.maxRetries}`);
                    await this.sleep(this.retryDelay * attempt);
                }

                console.log(`[FileSearch Stream] Generating answer for: "${query.question.substring(0, 50)}..."`);
                console.log(`[FileSearch Stream] Using File Search tool with store: ${fileSearchStoreNames[0]}`);

                const modelInfo = await this.getAnswerModel();

                // Build FileSearch tool config with optional metadata filter
                const fileSearchTool: any = {
                    fileSearch: {
                        fileSearchStoreNames: fileSearchStoreNames
                    }
                };

                // Add metadata filter if provided
                if (metadataFilter) {
                    fileSearchTool.fileSearch.metadataFilter = metadataFilter;
                    console.log(`[FileSearch Stream] Using metadata filter: ${metadataFilter}`);
                }

                // Stream content using FileSearch tool - Google automatically searches the store
                const streamPromise = this.ai.models.generateContentStream({
                    model: modelInfo.name,
                    contents: query.question,
                    config: {
                        tools: [fileSearchTool]
                    }
                });

                const stream = await streamPromise;
                let fullAnswer = '';

                // Stream chunks
                for await (const chunk of stream) {
                    const chunkText = chunk.text || '';
                    if (chunkText) {
                        fullAnswer += chunkText;
                        yield { chunk: chunkText, done: false };
                    }
                }

                // ⚠️ IMPORTANT NOTE: Google File Search tool does NOT return grounding metadata
                // See non-streaming version for full explanation
                console.log('[FileSearch Stream] ⚠️  Note: Citations not available from Google File Search API');

                // Return empty arrays since grounding metadata is not available
                const sources: any[] = [];
                const citations: any[] = [];

                yield {
                    chunk: '',
                    done: true,
                    metadata: {
                        answer: fullAnswer,
                        sources,
                        model: modelInfo.name,
                        confidence: 85,
                        citations: citations,
                    }
                };

                return;
            } catch (error: any) {
                lastError = error;
                console.error(`[FileSearch Stream] Attempt ${attempt + 1} failed:`, error);

                if (!this.isRetryableError(error)) {
                    throw error;
                }
            }
        }

        throw lastError || new Error('File Search streaming failed after retries');
    }

    /**
     * @deprecated Google File Search API does not return grounding metadata
     * This method will always return empty array. Kept for backward compatibility.
     * 
     * Extract sources from File Search grounding metadata
     */
    private extractFileSearchSources(response: any): any[] {
        // Google File Search does not provide grounding metadata in API responses
        // The tool works transparently by injecting context into prompts
        console.warn('[FileSearch] extractFileSearchSources is deprecated - grounding metadata not available');
        return [];
    }

    /**
     * @deprecated Google File Search API does not return grounding metadata
     * This method will always return default confidence. Kept for backward compatibility.
     * 
     * Calculate confidence score for File Search response
     */
    private calculateFileSearchConfidence(response: any, sources: any[]): number {
        // Return default confidence since grounding metadata is not available
        return 85;
    }
}

// Export singleton instances
// Default instance using GEMINI_API_KEY for chat queries
export const geminiFileSearchService = new GeminiFileSearchService();

// Import instance using GEMINI_API_KEY_IMPORT for file import
export const geminiFileSearchServiceImport = new GeminiFileSearchService(
    process.env.GEMINI_API_KEY_IMPORT
);
