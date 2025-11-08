/**
 * Chat Cache Service
 * 
 * Handles caching of Q&A for duplicate question optimization
 */

import crypto from 'crypto';
import type { RAGResponse } from '../types/rag.types.js';

interface CachedResponse {
    questionHash: string;
    originalQuestion: string;
    answer: string;
    sources: any[];
    model: string;
    confidence: number;
    tokenUsage: {
        input: number;
        output: number;
        total: number;
    };
    createdAt: Date;
    expiresAt: Date;
    hitCount: number;
}

class ChatCacheService {
    private cache = new Map<string, CachedResponse>();
    private readonly TTL_HOURS = 24; // Cache for 24 hours
    private readonly MAX_CACHE_SIZE = 1000; // Maximum cached entries
    private readonly MIN_CONFIDENCE = 70; // Only cache high-confidence answers

    constructor() {
        // Clean expired entries every hour
        setInterval(() => {
            this.cleanExpiredEntries();
        }, 60 * 60 * 1000);
    }

    /**
     * Generate a hash for the question to use as cache key
     */
    private generateQuestionHash(question: string): string {
        // Normalize question for better cache hits
        const normalized = question
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' '); // Normalize whitespace

        return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
    }

    /**
     * Check if question exists in cache and is still valid
     */
    async getCachedResponse(question: string): Promise<CachedResponse | null> {
        const hash = this.generateQuestionHash(question);
        const cached = this.cache.get(hash);

        if (!cached) {
            console.log(`[Cache] MISS: ${hash} - "${question.substring(0, 50)}..."`);
            return null;
        }

        // Check if expired
        if (cached.expiresAt < new Date()) {
            console.log(`[Cache] EXPIRED: ${hash} - removing`);
            this.cache.delete(hash);
            return null;
        }

        // Increment hit count
        cached.hitCount++;
        console.log(`[Cache] HIT: ${hash} - confidence: ${cached.confidence}%, hits: ${cached.hitCount}`);

        return cached;
    }

    /**
     * Store response in cache if it meets quality criteria
     */
    async setCachedResponse(question: string, response: RAGResponse): Promise<void> {
        // Only cache high-confidence responses
        if (response.confidence < this.MIN_CONFIDENCE) {
            console.log(`[Cache] SKIP: Low confidence (${response.confidence}% < ${this.MIN_CONFIDENCE}%)`);
            return;
        }

        const hash = this.generateQuestionHash(question);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.TTL_HOURS);

        const cached: CachedResponse = {
            questionHash: hash,
            originalQuestion: question,
            answer: response.answer,
            sources: response.sources,
            model: response.model,
            confidence: response.confidence,
            tokenUsage: response.tokenUsage,
            createdAt: new Date(),
            expiresAt,
            hitCount: 0
        };

        // Check cache size limit
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldestEntries(100); // Remove 100 oldest entries
        }

        this.cache.set(hash, cached);
        console.log(`[Cache] STORED: ${hash} - confidence: ${response.confidence}%, expires: ${expiresAt.toISOString()}`);
    }

    /**
     * Clean expired entries from cache
     */
    private cleanExpiredEntries(): void {
        const now = new Date();
        let removedCount = 0;

        for (const [hash, entry] of this.cache.entries()) {
            if (entry.expiresAt < now) {
                this.cache.delete(hash);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`[Cache] Cleaned ${removedCount} expired entries, cache size: ${this.cache.size}`);
        }
    }

    /**
     * Remove oldest entries when cache is full
     */
    private evictOldestEntries(count: number): void {
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());

        for (let i = 0; i < count && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
        }

        console.log(`[Cache] Evicted ${count} oldest entries, cache size: ${this.cache.size}`);
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        hitRate: number;
        topQuestions: Array<{ question: string; hits: number; confidence: number }>;
    } {
        const entries = Array.from(this.cache.values());
        const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
        const totalQueries = entries.length + totalHits; // Approximation

        const topQuestions = entries
            .filter(entry => entry.hitCount > 0)
            .sort((a, b) => b.hitCount - a.hitCount)
            .slice(0, 10)
            .map(entry => ({
                question: entry.originalQuestion.substring(0, 100),
                hits: entry.hitCount,
                confidence: entry.confidence
            }));

        return {
            size: this.cache.size,
            hitRate: totalQueries > 0 ? (totalHits / totalQueries) * 100 : 0,
            topQuestions
        };
    }

    /**
     * Clear all cache (admin function)
     */
    clearCache(): void {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`[Cache] Cleared all ${size} entries`);
    }

    /**
     * Remove specific cached question by pattern
     */
    invalidateByPattern(pattern: string): number {
        let removedCount = 0;
        const regex = new RegExp(pattern, 'i');

        for (const [hash, entry] of this.cache.entries()) {
            if (regex.test(entry.originalQuestion)) {
                this.cache.delete(hash);
                removedCount++;
            }
        }

        console.log(`[Cache] Invalidated ${removedCount} entries matching pattern: ${pattern}`);
        return removedCount;
    }
}

// Export singleton instance
export const chatCacheService = new ChatCacheService();