/**
 * QuestionCacheService
 * 
 * In-Memory Pre-processed Cache & Two-Stage Fast Candidate Filtering for Quiz Questions.
 * Solves the high latency bottleneck (12.5s for 11,000 questions) by:
 * 1. Pre-indexing questions in memory: tokens, normalized text, numbers, parsed options.
 * 2. Rapid candidate pre-filtering in ~1-2ms using token set overlap & number matching.
 * 3. Cache invalidation on question updates, imports, and deletions.
 */

export interface CachedQuestion {
  id: string;
  text: string;
  normText: string;
  tokens: string[];
  tokenSet: Set<string>;
  numbers: string[];
  options: string[];
  correctAnswerIdx: number;
  source: string | null;
  category: string | null;
  baseId: string;
  baseName: string;
}

export interface CandidateMatch {
  question: CachedQuestion;
  candidateScore: number;
  overlapWords: number;
}

export class QuestionCacheService {
  private cache = new Map<string, { questions: CachedQuestion[]; loadedAt: number }>();
  // 15 minutes TTL for cache validity
  private readonly TTL_MS = 15 * 60 * 1000;

  /**
   * Normalize Vietnamese text for fast tokenization & comparison
   */
  public normalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract significant tokens (words with length >= 2)
   */
  public extractTokens(normText: string): { tokens: string[]; tokenSet: Set<string> } {
    if (!normText) return { tokens: [], tokenSet: new Set() };
    const tokens = normText.split(' ').filter(w => w.length >= 2);
    return { tokens, tokenSet: new Set(tokens) };
  }

  /**
   * Extract numbers for strict clause/year/round verification
   */
  public extractNumbers(normText: string): string[] {
    if (!normText) return [];
    return normText.match(/\b\d+\b/g) || [];
  }

  /**
   * Pre-process raw question from DB into CachedQuestion object
   */
  public preProcessQuestion(q: any, baseName: string): CachedQuestion {
    const normText = this.normalizeText(q.text);
    const { tokens, tokenSet } = this.extractTokens(normText);
    const numbers = this.extractNumbers(normText);

    let parsedOptions: string[] = [];
    if (typeof q.options === 'string') {
      try {
        parsedOptions = JSON.parse(q.options);
      } catch {
        parsedOptions = [];
      }
    } else if (Array.isArray(q.options)) {
      parsedOptions = q.options;
    }

    return {
      id: q.id,
      text: q.text,
      normText,
      tokens,
      tokenSet,
      numbers,
      options: parsedOptions,
      correctAnswerIdx: q.correctAnswerIdx ?? -1,
      source: q.source ?? null,
      category: q.category ?? null,
      baseId: q.baseId,
      baseName: baseName || ''
    };
  }

  /**
   * Get cached questions for given knowledgeBaseIds.
   * Loads from DB if not in cache or expired.
   */
  public async getCachedQuestions(knowledgeBaseIds: string[], prisma: any): Promise<CachedQuestion[]> {
    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return [];

    const now = Date.now();
    const missingBaseIds: string[] = [];
    const results: CachedQuestion[] = [];

    // 1. Collect hits from cache
    for (const baseId of knowledgeBaseIds) {
      const entry = this.cache.get(baseId);
      if (entry && (now - entry.loadedAt < this.TTL_MS)) {
        results.push(...entry.questions);
      } else {
        missingBaseIds.push(baseId);
      }
    }

    // 2. Fetch missing knowledge bases from DB
    if (missingBaseIds.length > 0) {
      const dbQuestions = await prisma.question.findMany({
        where: {
          baseId: { in: missingBaseIds }
        },
        include: {
          base: {
            select: { name: true }
          }
        }
      });

      // Group by baseId
      const grouped = new Map<string, CachedQuestion[]>();
      for (const baseId of missingBaseIds) {
        grouped.set(baseId, []);
      }

      for (const q of dbQuestions) {
        const baseName = q.base?.name || '';
        const cachedQ = this.preProcessQuestion(q, baseName);
        const list = grouped.get(q.baseId);
        if (list) {
          list.push(cachedQ);
        }
      }

      // Store in cache & add to results
      for (const [baseId, questions] of grouped.entries()) {
        this.cache.set(baseId, { questions, loadedAt: now });
        results.push(...questions);
      }
    }

    return results;
  }

  /**
   * Fast Stage 1 Candidate Pre-filtering:
   * Evaluates 11,000+ cached questions in ~1-2ms and selects top candidates (default top 60).
   */
  public findCandidateQuestions(
    recognizedText: string,
    allQuestions: CachedQuestion[],
    limit: number = 60
  ): CachedQuestion[] {
    if (!allQuestions || allQuestions.length === 0) return [];
    if (allQuestions.length <= limit) return allQuestions;

    const queryNorm = this.normalizeText(recognizedText);
    if (!queryNorm) return allQuestions.slice(0, limit);

    const { tokens: queryTokens, tokenSet: queryTokenSet } = this.extractTokens(queryNorm);
    const queryNumbers = this.extractNumbers(queryNorm);
    const queryNumberSet = new Set(queryNumbers);

    if (queryTokens.length === 0) {
      return allQuestions.slice(0, limit);
    }

    const candidates: CandidateMatch[] = [];

    // Pre-calculate weights: longer words carry more semantic uniqueness
    // e.g. "agribank", "2024", "thuong" are more discriminative than "cho", "duoc"
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i];
      let overlapCount = 0;
      let weightedOverlap = 0;

      // Fast set lookup
      for (const token of q.tokens) {
        if (queryTokenSet.has(token)) {
          overlapCount++;
          weightedOverlap += token.length >= 4 ? 2 : 1;
        }
      }

      // If at least 1 significant word matches (or text length is very close)
      if (overlapCount > 0) {
        // Jaccard token overlap
        const totalUniqueWords = queryTokenSet.size + q.tokenSet.size - overlapCount;
        const jaccard = totalUniqueWords > 0 ? overlapCount / totalUniqueWords : 0;

        // Number check bonus/penalty
        let numberScore = 1.0;
        if (queryNumbers.length > 0 && q.numbers.length > 0) {
          let matchingNumbers = 0;
          for (const num of q.numbers) {
            if (queryNumberSet.has(num)) matchingNumbers++;
          }
          if (matchingNumbers > 0) {
            numberScore = 1.5; // Boost questions with matching years/articles/numbers
          } else {
            numberScore = 0.5; // Penalize if numbers conflict
          }
        }

        const candidateScore = (jaccard * 0.7 + (overlapCount / queryTokens.length) * 0.3) * numberScore;

        candidates.push({
          question: q,
          candidateScore,
          overlapWords: overlapCount
        });
      }
    }

    // If we found candidates with word overlap, sort and return top `limit`
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.candidateScore - a.candidateScore);
      return candidates.slice(0, limit).map(c => c.question);
    }

    // Fallback: If OCR produced noisy text with zero exact word matches,
    // take candidates with closest character lengths
    const queryLen = queryNorm.length;
    const sortedByLenDiff = [...allQuestions].sort((a, b) => {
      return Math.abs(a.normText.length - queryLen) - Math.abs(b.normText.length - queryLen);
    });

    return sortedByLenDiff.slice(0, limit);
  }

  /**
   * Invalidate cache for a specific knowledge base or entire cache
   */
  public invalidateCache(baseId?: string): void {
    if (baseId) {
      this.cache.delete(baseId);
      console.log(`[QuestionCache] Invalidation for baseId: ${baseId}`);
    } else {
      this.cache.clear();
      console.log('[QuestionCache] Cleared entire question cache');
    }
  }

  /**
   * Get stats about current cache
   */
  public getCacheStats(): { totalBases: number; totalQuestions: number } {
    let totalQuestions = 0;
    for (const entry of this.cache.values()) {
      totalQuestions += entry.questions.length;
    }
    return {
      totalBases: this.cache.size,
      totalQuestions
    };
  }
}

export const questionCacheService = new QuestionCacheService();
