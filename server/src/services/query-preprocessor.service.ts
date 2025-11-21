/**
 * Query Preprocessor Service
 * 
 * Preprocesses user queries before embedding to improve RAG search accuracy.
 * Transforms natural language questions into legal document style queries.
 */

import { GoogleGenAI } from '@google/genai';
import { modelSettingsService } from './model-settings.service.js';
import { geminiTrackerService } from './gemini-tracker.service.js';

interface QueryPreprocessingResult {
    originalQuery: string;
    simplifiedQueries: string[];
    reasoning: string;
    confidence: number;
}

class QueryPreprocessorService {
    private ai: GoogleGenAI | null = null;
    private cache: Map<string, QueryPreprocessingResult> = new Map();
    private maxCacheSize = 100;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.ai = new GoogleGenAI({ apiKey });
        }
    }

    /**
     * Preprocess query before embedding generation
     * Returns multiple simplified/rephrased versions suitable for legal document search
     */
    async preprocessQuery(query: string, sessionId?: string, userId?: string): Promise<QueryPreprocessingResult> {
        // Check cache first
        const cacheKey = query.toLowerCase().trim();
        if (this.cache.has(cacheKey)) {
            console.log('[QueryPreprocessor] Cache hit for query');
            return this.cache.get(cacheKey)!;
        }

        if (!this.ai) {
            console.warn('[QueryPreprocessor] AI not configured, using original query');
            return {
                originalQuery: query,
                simplifiedQueries: [query],
                reasoning: 'AI preprocessing not available',
                confidence: 0.5,
            };
        }

        try {
            const cheapModel = await modelSettingsService.getCheaperModel();
            const prompt = this.buildPreprocessingPrompt(query);

            console.log('[QueryPreprocessor] Preprocessing query with model:', cheapModel);

            const trackingId = await geminiTrackerService.startTracking({
                endpoint: 'generateContent',
                modelName: cheapModel,
                requestType: 'query_preprocessing',
                userId,
                sessionId,
                metadata: { query },
            });

            const response = await this.ai.models.generateContent({
                model: cheapModel,
                contents: [prompt],
                config: {
                    temperature: 0.4, // Moderate creativity for rephrasing
                    maxOutputTokens: 800,
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

            console.log('[QueryPreprocessor] Raw AI response:', text.substring(0, 200) + '...');

            const result = this.parsePreprocessingResponse(text, query);

            // Cache the result
            this.cacheResult(cacheKey, result);

            console.log('[QueryPreprocessor] Generated', result.simplifiedQueries.length, 'query variants');
            result.simplifiedQueries.forEach((q, i) => {
                console.log(`  ${i + 1}. "${q}"`);
            });

            return result;
        } catch (error) {
            console.error('[QueryPreprocessor] Preprocessing failed:', error);
            // Fallback to basic simplification
            return this.basicPreprocessing(query);
        }
    }

    /**
     * Build preprocessing prompt for AI
     */
    private buildPreprocessingPrompt(query: string): string {
        return `Bạn là chuyên gia phân tích và đơn giản hóa câu hỏi để tìm kiếm trong văn bản pháp luật Việt Nam.

CÂU HỎI GỐC:
"${query}"

NHIỆM VỤ:
Phân tích câu hỏi và tạo ra 2-4 câu hỏi đơn giản hơn, phù hợp với văn phong của văn bản quy định/quy chế ngân hàng.

NGUYÊN TẮC CHUYỂN ĐỔI:
1. **Đơn giản hóa ngôn ngữ**: Chuyển từ câu hỏi tự nhiên sang thuật ngữ chính thức
   - "Tôi muốn biết..." → "Quy định về..."
   - "Cần bao nhiêu..." → "Điều kiện..." hoặc "Mức..."
   - "Có được phép..." → "Quyền..." hoặc "Điều kiện..."
   
2. **Tách câu hỏi phức tạp**: Nếu có nhiều ý, tách thành các câu đơn
   - "Điều kiện vay và lãi suất" → ["Điều kiện vay vốn", "Lãi suất cho vay"]
   
3. **Sử dụng thuật ngữ pháp lý**:
   - "người vay" → "khách hàng vay vốn"
   - "đủ điều kiện" → "đáp ứng yêu cầu" hoặc "đủ điều kiện theo quy định"
   - "được phép" → "có quyền" hoặc "được quy định"
   
4. **Loại bỏ thông tin dư thừa**: Bỏ các từ ngữ không cần thiết
   - "Xin hỏi là..." → bỏ
   - "cho em biết với ạ" → bỏ
   - "cụ thể như thế nào" → giữ ý chính
   
5. **Thêm từ đồng nghĩa quan trọng**: Mở rộng với các thuật ngữ liên quan
   - "vay tiền" → thêm "vay vốn", "tín dụng", "cho vay"
   - "lãi suất" → thêm "lãi", "mức lãi"
   - "thời hạn" → thêm "kỳ hạn", "thời gian"

VÍ DỤ CHUYỂN ĐỔI:

Câu hỏi gốc: "Tôi muốn vay 500 triệu để mua nhà thì cần điều kiện gì?"
→ Câu đơn giản:
1. "Điều kiện vay vốn mua nhà"
2. "Quy định cho vay mua nhà"
3. "Yêu cầu đối với khách hàng vay mua nhà"

Câu hỏi gốc: "Lãi suất tiền gửi tiết kiệm kỳ hạn 12 tháng là bao nhiêu?"
→ Câu đơn giản:
1. "Lãi suất tiền gửi tiết kiệm 12 tháng"
2. "Mức lãi tiết kiệm kỳ hạn 12 tháng"
3. "Quy định lãi suất gửi tiết kiệm"

Câu hỏi gốc: "Người dưới 18 tuổi có được vay tiền không?"
→ Câu đơn giản:
1. "Điều kiện độ tuổi vay vốn"
2. "Quy định về tuổi khách hàng vay"
3. "Yêu cầu tuổi tối thiểu cho vay"

TRẢ LỜI THEO FORMAT JSON (chỉ trả JSON, không thêm text khác):
{
  "simplifiedQueries": [
    "Câu hỏi đơn giản 1",
    "Câu hỏi đơn giản 2",
    "Câu hỏi đơn giản 3"
  ],    
  "reasoning": "Giải thích ngắn gọn cách chuyển đổi",
  "confidence": 0.85
}

CHÚ Ý:
- "simplifiedQueries" phải là mảng 2-4 câu hỏi ngắn gọn, rõ ràng
- Các câu hỏi phải phù hợp với văn phong văn bản pháp luật
- "confidence" từ 0.0-1.0, phản ánh độ chắc chắn của việc chuyển đổi
- Ưu tiên các thuật ngữ thường xuất hiện trong quy định, quy chế
- MỖI câu nên tập trung vào MỘT khía cạnh cụ thể`;
    }

    /**
     * Parse AI response
     */
    private parsePreprocessingResponse(
        response: string,
        originalQuery: string
    ): QueryPreprocessingResult {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate queries
            let simplifiedQueries = (parsed.simplifiedQueries || [])
                .filter((q: any) => typeof q === 'string' && q.trim().length > 0)
                .map((q: string) => q.trim());

            // Ensure we have at least the original query
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

            const confidence = Math.min(Math.max(parsed.confidence || 0.7, 0), 1);

            return {
                originalQuery,
                simplifiedQueries,
                reasoning: parsed.reasoning || 'Phân tích tự động',
                confidence,
            };
        } catch (error) {
            console.error('[QueryPreprocessor] Failed to parse response:', error);
            return this.basicPreprocessing(originalQuery);
        }
    }

    /**
     * Basic preprocessing without AI (fallback)
     */
    private basicPreprocessing(query: string): QueryPreprocessingResult {
        const cleaned = query
            .toLowerCase()
            .replace(/[?!.]/g, '')
            .replace(/xin hỏi|cho (em|tôi|mình) (biết|hỏi)|vui lòng|giúp (em|tôi|mình)|ạ|à/gi, '')
            .trim();

        // Simple keyword expansion
        const simplifiedQueries = [query]; // Keep original

        // Add a cleaned version
        if (cleaned !== query) {
            simplifiedQueries.push(cleaned);
        }

        // Basic term substitution
        const expansions: Record<string, string[]> = {
            'vay tiền': ['vay vốn', 'cho vay', 'tín dụng'],
            'gửi tiền': ['tiền gửi', 'gửi tiết kiệm'],
            'lãi suất': ['mức lãi', 'lãi'],
            'điều kiện': ['quy định', 'yêu cầu'],
            'được phép': ['có quyền', 'được quy định'],
        };

        for (const [key, alternatives] of Object.entries(expansions)) {
            if (cleaned.includes(key)) {
                // Add one alternative expansion
                const expanded = cleaned.replace(key, alternatives[0]);
                if (!simplifiedQueries.includes(expanded)) {
                    simplifiedQueries.push(expanded);
                }
                break; // Only one expansion to keep it simple
            }
        }

        return {
            originalQuery: query,
            simplifiedQueries: simplifiedQueries.slice(0, 3),
            reasoning: 'Sử dụng xử lý cơ bản (không có AI)',
            confidence: 0.5,
        };
    }

    /**
     * Cache management
     */
    private cacheResult(key: string, result: QueryPreprocessingResult): void {
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry (first key)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, result);
    }

    /**
     * Clear cache
     */
    public clearCache(): void {
        this.cache.clear();
        console.log('[QueryPreprocessor] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
        };
    }
}

// Export singleton instance
export const queryPreprocessorService = new QueryPreprocessorService();
