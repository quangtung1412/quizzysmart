/**
 * Query Analyzer Service
 * 
 * Analyzes user queries to determine which collections to search in.
 * Uses cheaper AI models to reduce costs while maintaining effectiveness.
 */

import { GoogleGenAI } from '@google/genai';
import { modelSettingsService } from './model-settings.service.js';

interface QueryAnalysisResult {
  collections: string[];
  reasoning: string;
  confidence: number;
}

class QueryAnalyzerService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Analyze query to determine which collections to search
   */
  async analyzeQuery(
    query: string,
    availableCollections: string[]
  ): Promise<QueryAnalysisResult> {
    if (!this.ai) {
      console.warn('[QueryAnalyzer] Gemini not configured, using default collection');
      return {
        collections: [availableCollections[0] || 'vietnamese_documents'],
        reasoning: 'AI analysis not available, using default collection',
        confidence: 0.5,
      };
    }

    try {
      // Get cheaper model from settings
      const cheapModel = await modelSettingsService.getCheaperModel();
      const prompt = this.buildAnalysisPrompt(query, availableCollections);
      
      console.log('[QueryAnalyzer] Analyzing query with model:', cheapModel);
      
      const response = await this.ai.models.generateContent({
        model: cheapModel,
        contents: [prompt],
        config: {
          temperature: 0.3, // Lower temperature for more focused analysis
          maxOutputTokens: 500,
        },
      });

      const text = response.text || '';
      console.log('[QueryAnalyzer] Raw AI response:', text);

      // Parse the AI response
      const analysis = this.parseAnalysisResponse(text, availableCollections);
      
      console.log('[QueryAnalyzer] Analysis result:', analysis);
      
      return analysis;
    } catch (error) {
      console.error('[QueryAnalyzer] Analysis failed:', error);
      // Fallback to quick heuristic analysis
      console.log('[QueryAnalyzer] Falling back to keyword-based analysis');
      return this.quickAnalyze(query, availableCollections);
    }
  }

  /**
   * Build the analysis prompt for the AI
   */
  private buildAnalysisPrompt(query: string, availableCollections: string[]): string {
    return `Bạn là một trợ lý AI chuyên phân tích câu hỏi để xác định nguồn tài liệu phù hợp.

CÂU HỎI CỦA NGƯỜI DÙNG:
"${query}"

CÁC COLLECTION CÓ SẴN:
${availableCollections.map((c, i) => `${i + 1}. ${c}`).join('\n')}

NHIỆM VỤ:
Phân tích câu hỏi và xác định nên tìm kiếm trong collection nào. Một câu hỏi có thể liên quan đến nhiều collection.

GỢI Ý PHÂN LOẠI:
- Tiền gửi, gửi tiết kiệm, lãi suất tiền gửi → "tien_gui" hoặc collection có liên quan
- Tiền vay, vay vốn, cho vay, lãi suất vay → "tien_vay" hoặc collection có liên quan
- Chuyển tiền, giao dịch, thanh toán → "chuyen_tien" hoặc collection có liên quan
- Thẻ, thẻ tín dụng, thẻ ghi nợ → "the" hoặc collection có liên quan
- Nếu câu hỏi chung chung hoặc không rõ ràng → tìm trong TẤT CẢ collections
- Nếu câu hỏi đề cập nhiều chủ đề → chọn NHIỀU collections phù hợp

TRẢ LỜI THEO FORMAT JSON (chỉ trả về JSON, không thêm text khác):
{
  "collections": ["collection_name_1", "collection_name_2"],
  "reasoning": "Lý do ngắn gọn tại sao chọn các collection này",
  "confidence": 0.8
}

CHÚ Ý:
- "collections" phải là mảng các tên collection có trong danh sách trên
- "confidence" là số từ 0.0 đến 1.0
- Nếu không chắc chắn, hãy chọn nhiều collections (confidence thấp hơn)
- Nếu chắc chắn, chỉ chọn 1-2 collections chính xác nhất (confidence cao)`;
  }

  /**
   * Parse AI response to extract collection names
   */
  private parseAnalysisResponse(
    response: string,
    availableCollections: string[]
  ): QueryAnalysisResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and filter collections
      const validCollections = (parsed.collections || [])
        .filter((c: string) => availableCollections.includes(c));

      // If no valid collections, use all collections as fallback
      if (validCollections.length === 0) {
        console.warn('[QueryAnalyzer] No valid collections found, using all');
        return {
          collections: availableCollections,
          reasoning: parsed.reasoning || 'Không tìm thấy collection phù hợp, tìm trong tất cả',
          confidence: 0.3,
        };
      }

      return {
        collections: validCollections,
        reasoning: parsed.reasoning || 'Phân tích tự động',
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
      };
    } catch (error) {
      console.error('[QueryAnalyzer] Failed to parse response:', error);
      // Return all collections if parsing fails
      return {
        collections: availableCollections,
        reasoning: 'Không thể phân tích, tìm trong tất cả collections',
        confidence: 0.3,
      };
    }
  }

  /**
   * Quick heuristic analysis (fallback without AI)
   * Uses keyword matching for basic collection routing
   */
  async quickAnalyze(
    query: string,
    availableCollections: string[]
  ): Promise<QueryAnalysisResult> {
    const queryLower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const keywords: Record<string, string[]> = {
      tien_gui: ['tien gui', 'gui tiet kiem', 'lai suat gui', 'ky han', 'so tiet kiem'],
      tien_vay: ['tien vay', 'vay von', 'cho vay', 'lai suat vay', 'khoan vay', 'tin dung'],
      chuyen_tien: ['chuyen tien', 'chuyen khoan', 'giao dich', 'thanh toan'],
      the: ['the', 'the tin dung', 'the ghi no', 'the atm'],
    };

    const matchedCollections: string[] = [];
    let maxMatches = 0;

    for (const [collection, keywordList] of Object.entries(keywords)) {
      if (!availableCollections.includes(collection)) continue;

      let matches = 0;
      for (const keyword of keywordList) {
        if (queryLower.includes(keyword)) {
          matches++;
        }
      }

      if (matches > 0) {
        matchedCollections.push(collection);
        maxMatches = Math.max(maxMatches, matches);
      }
    }

    // If no matches, return all collections
    if (matchedCollections.length === 0) {
      return {
        collections: availableCollections,
        reasoning: 'Không tìm thấy từ khóa cụ thể, tìm trong tất cả collections',
        confidence: 0.3,
      };
    }

    return {
      collections: matchedCollections,
      reasoning: `Tìm thấy từ khóa liên quan đến: ${matchedCollections.join(', ')}`,
      confidence: Math.min(0.5 + (maxMatches * 0.1), 0.9),
    };
  }
}

// Export singleton instance
export const queryAnalyzerService = new QueryAnalyzerService();
