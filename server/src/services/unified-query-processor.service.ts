/**
 * Unified Query Processor Service
 * 
 * Combines query analysis and preprocessing into a single AI call to reduce costs.
 * Analyzes user query to determine collections AND generates simplified query variants.
 */

import { GoogleGenAI } from '@google/genai';
import { modelSettingsService } from './model-settings.service.js';
import { geminiTrackerService } from './gemini-tracker.service.js';

interface UnifiedQueryResult {
    // From Query Analysis
    collections: string[];
    collectionReasoning: string;
    collectionConfidence: number;

    // From Query Preprocessing
    originalQuery: string;
    simplifiedQueries: string[];
    preprocessingReasoning: string;
    preprocessingConfidence: number;
}

class UnifiedQueryProcessorService {
    private ai: GoogleGenAI | null = null;
    private cache: Map<string, UnifiedQueryResult> = new Map();
    private readonly MAX_CACHE_SIZE = 100;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.ai = new GoogleGenAI({ apiKey });
        }
    }

    /**
     * Process query: analyze collections AND preprocess query variants in ONE API call
     */
    async processQuery(
        query: string,
        availableCollections: string[],
        sessionId?: string,
        userId?: string
    ): Promise<UnifiedQueryResult> {
        // Check cache first
        const cacheKey = `${query.toLowerCase().trim()}-${availableCollections.join(',')}`;
        if (this.cache.has(cacheKey)) {
            console.log('[UnifiedQueryProcessor] Cache hit');
            return this.cache.get(cacheKey)!;
        }

        if (!this.ai) {
            console.warn('[UnifiedQueryProcessor] AI not configured, using fallback');
            return this.getFallbackResult(query, availableCollections);
        }

        try {
            const cheapModel = await modelSettingsService.getCheaperModel();
            const prompt = this.buildUnifiedPrompt(query, availableCollections);

            console.log('[UnifiedQueryProcessor] Processing query with model:', cheapModel);

            const trackingId = await geminiTrackerService.startTracking({
                endpoint: 'generateContent',
                modelName: cheapModel,
                requestType: 'unified_query_processing',
                userId,
                sessionId,
                metadata: { query, availableCollections },
            });

            const response = await this.ai.models.generateContent({
                model: cheapModel,
                contents: [prompt],
                config: {
                    temperature: 0.4,
                    maxOutputTokens: 1000,
                },
            });

            const text = response.text || '';
            const usageMetadata: any = (response as any).usageMetadata || {};
            const inputTokens = usageMetadata.promptTokenCount || 0;
            const outputTokens = usageMetadata.candidatesTokenCount || 0;

            await geminiTrackerService.endTracking(trackingId, {
                inputTokens,
                outputTokens,
                status: 'success',
            });

            console.log('[UnifiedQueryProcessor] Raw AI response:', text);

            const result = this.parseUnifiedResponse(text, query, availableCollections);

            // Cache the result
            this.cacheResult(cacheKey, result);

            console.log('[UnifiedQueryProcessor] Processed result:', {
                collections: result.collections,
                variantCount: result.simplifiedQueries.length,
                collectionConfidence: result.collectionConfidence.toFixed(2),
                preprocessingConfidence: result.preprocessingConfidence.toFixed(2),
            });

            return result;
        } catch (error) {
            console.error('[UnifiedQueryProcessor] Processing failed:', error);
            return this.getFallbackResult(query, availableCollections);
        }
    }

    /**
     * Build unified prompt combining both analysis and preprocessing
     */
    private buildUnifiedPrompt(query: string, availableCollections: string[]): string {
        return `Bạn là trợ lý AI chuyên xử lý câu hỏi về tài liệu quy định, quy chế ngân hàng.

CÂU HỎI CỦA NGƯỜI DÙNG:
"${query}"

CÁC COLLECTION TÀI LIỆU CÓ SẴN:
${availableCollections.map((c, i) => `${i + 1}. ${c}`).join('\n')}

NHIỆM VỤ 1 - PHÂN TÍCH COLLECTION:
Xác định nên tìm kiếm trong collection nào dựa trên nội dung câu hỏi:
- Tiền gửi, gửi tiết kiệm, lãi suất tiền gửi → "tien_gui"
- Tiền vay, vay vốn, cho vay, lãi suất vay → "tien_vay"
- Chuyển tiền, giao dịch, thanh toán → "chuyen_tien"
- Thẻ, thẻ tín dụng, thẻ ghi nợ → "the"
- Câu hỏi chung hoặc không rõ ràng → TẤT CẢ collections
- Nếu KHÔNG CHẮC CHẮN → trả về TẤT CẢ với confidence < 0.5

NHIỆM VỤ 2 - TẠO QUERY VARIANTS:
Chuyển đổi câu hỏi thành 2-4 câu ngắn gọn, phù hợp với văn phong văn bản pháp luật:
- Loại bỏ từ thừa, ngữ cảnh cá nhân
- Dùng thuật ngữ chuyên ngành thay vì từ thông dụng
- Mỗi variant tập trung vào 1 khía cạnh
- Đảm bảo các variant bao quát đầy đủ ý nghĩa câu hỏi gốc

VÍ DỤ:
Câu hỏi: "Tôi muốn vay 500 triệu để mua nhà thì cần điều kiện gì?"
→ Collections: ["tien_vay"] (nếu có), confidence: 0.9
→ Variants:
  1. "Điều kiện vay vốn mua nhà"
  2. "Quy định cho vay mua nhà"
  3. "Yêu cầu đối với khách hàng vay mua nhà"

Câu hỏi: "Lãi suất tiền gửi tiết kiệm kỳ hạn 12 tháng là bao nhiêu?"
→ Collections: ["tien_gui"] (nếu có), confidence: 0.95
→ Variants:
  1. "Lãi suất tiền gửi tiết kiệm 12 tháng"
  2. "Mức lãi tiết kiệm kỳ hạn 12 tháng"

TRẢ LỜI THEO FORMAT JSON (chỉ trả JSON, KHÔNG thêm text khác):
{
  "collections": ["collection_name_1", "collection_name_2"],
  "collectionReasoning": "Lý do chọn collections này",
  "collectionConfidence": 0.8,
  "simplifiedQueries": [
    "Câu đơn giản 1",
    "Câu đơn giản 2",
    "Câu đơn giản 3"
  ],
  "preprocessingReasoning": "Cách chuyển đổi câu hỏi",
  "preprocessingConfidence": 0.85
}

CHÚ Ý:
- "collections" phải là mảng tên collection từ danh sách trên
- "simplifiedQueries" phải là mảng 2-4 câu ngắn gọn
- Cả 2 confidence đều từ 0.0-1.0
- Collections: Nếu không chắc chắn → chọn TẤT CẢ với confidence < 0.5
- Queries: Ưu tiên thuật ngữ pháp luật, mỗi câu tập trung 1 khía cạnh`;
    }

    /**
     * Parse unified AI response
     */
    private parseUnifiedResponse(
        response: string,
        originalQuery: string,
        availableCollections: string[]
    ): UnifiedQueryResult {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Parse collections
            let collections = (parsed.collections || [])
                .filter((c: any) => typeof c === 'string' && availableCollections.includes(c));

            if (collections.length === 0) {
                collections = availableCollections; // Fallback to all
            }

            // Parse simplified queries
            let simplifiedQueries = (parsed.simplifiedQueries || [])
                .filter((q: any) => typeof q === 'string' && q.trim().length > 0)
                .map((q: string) => q.trim());

            if (simplifiedQueries.length === 0) {
                simplifiedQueries = [originalQuery];
            }

            // Limit to max 4 queries
            if (simplifiedQueries.length > 4) {
                simplifiedQueries = simplifiedQueries.slice(0, 4);
            }

            // Always include original query as first option
            if (!simplifiedQueries.includes(originalQuery)) {
                simplifiedQueries.unshift(originalQuery);
            }

            return {
                collections,
                collectionReasoning: parsed.collectionReasoning || 'AI analysis',
                collectionConfidence: Math.min(Math.max(parsed.collectionConfidence || 0.5, 0), 1),
                originalQuery,
                simplifiedQueries,
                preprocessingReasoning: parsed.preprocessingReasoning || 'Query preprocessing',
                preprocessingConfidence: Math.min(Math.max(parsed.preprocessingConfidence || 0.7, 0), 1),
            };
        } catch (error) {
            console.error('[UnifiedQueryProcessor] Failed to parse response:', error);
            return this.getFallbackResult(originalQuery, availableCollections);
        }
    }

    /**
     * Fallback result when AI is unavailable
     */
    private getFallbackResult(query: string, availableCollections: string[]): UnifiedQueryResult {
        return {
            collections: availableCollections,
            collectionReasoning: 'AI not available, searching all collections',
            collectionConfidence: 0.5,
            originalQuery: query,
            simplifiedQueries: [query],
            preprocessingReasoning: 'AI not available, using original query',
            preprocessingConfidence: 0.5,
        };
    }

    /**
     * Cache management
     */
    private cacheResult(key: string, result: UnifiedQueryResult): void {
        // Implement LRU: remove oldest if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, result);
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE,
        };
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
        console.log('[UnifiedQueryProcessor] Cache cleared');
    }
}

export const unifiedQueryProcessorService = new UnifiedQueryProcessorService();
export type { UnifiedQueryResult };
