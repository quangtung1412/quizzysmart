/**
 * Text difference and similarity utility for question and option comparisons.
 * Compares extracted text (from image) with reference text (from database)
 * and classifies word tokens into 'match', 'partial' (yellow), or 'mismatch' (red).
 */

export interface DiffToken {
  text: string;
  status: 'match' | 'partial' | 'mismatch';
  refText?: string;
}

/**
 * Normalize word for similarity calculation (lowercase, remove Vietnamese diacritics, keep alphanumeric)
 */
export function normalizeWord(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Standard Levenshtein distance calculation
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

/**
 * Compute similarity score between two words [0.0, 1.0]
 * Strictly treats differing pure numbers as 0.0 (mismatch)
 */
export function wordSimilarity(w1: string, w2: string): number {
  const n1 = normalizeWord(w1);
  const n2 = normalizeWord(w2);

  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;

  // If either word is a pure number, they must match identically
  const isNum1 = /^\d+$/.test(n1);
  const isNum2 = /^\d+$/.test(n2);
  if (isNum1 || isNum2) {
    return isNum1 && isNum2 && n1 === n2 ? 1.0 : 0.0;
  }

  const maxLen = Math.max(n1.length, n2.length);
  const dist = levenshteinDistance(n1, n2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Align and compute token-level differences between extracted text and reference text.
 * Uses Needleman-Wunsch sequence alignment on word tokens.
 */
export function computeDiffTokens(extracted: string, reference: string): DiffToken[] {
  if (!extracted || !extracted.trim()) return [];
  if (!reference || !reference.trim()) {
    return [{ text: extracted, status: 'match' }];
  }

  // Tokenize extracted text into words, punctuation, and whitespace
  // Regex matches word tokens (letters & digits) or non-word clusters or whitespace
  const rawExtractedTokens = extracted.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+|\s+/gu) || [extracted];
  const rawRefTokens = reference.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+|\s+/gu) || [reference];

  const extWords: Array<{ tok: string; rawIdx: number; norm: string }> = [];
  rawExtractedTokens.forEach((tok, idx) => {
    if (/[\p{L}\p{N}]/u.test(tok)) {
      extWords.push({ tok, rawIdx: idx, norm: normalizeWord(tok) });
    }
  });

  const refWords: Array<{ tok: string; rawIdx: number; norm: string }> = [];
  rawRefTokens.forEach((tok, idx) => {
    if (/[\p{L}\p{N}]/u.test(tok)) {
      refWords.push({ tok, rawIdx: idx, norm: normalizeWord(tok) });
    }
  });

  // If no words in extracted or reference, return raw as match
  if (extWords.length === 0 || refWords.length === 0) {
    return rawExtractedTokens.map(tok => ({ text: tok, status: 'match' }));
  }

  // Needleman-Wunsch Alignment Matrix
  const N = extWords.length;
  const M = refWords.length;
  const dp: number[][] = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));

  const gapPenalty = 0.5;
  for (let i = 0; i <= N; i++) dp[i][0] = -i * gapPenalty;
  for (let j = 0; j <= M; j++) dp[0][j] = -j * gapPenalty;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const sim = wordSimilarity(extWords[i - 1].tok, refWords[j - 1].tok);
      let matchScore = -1.0;
      if (sim >= 0.85) {
        matchScore = 2.0;
      } else if (sim >= 0.5) {
        matchScore = 0.5;
      }

      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + matchScore,
        dp[i - 1][j] - gapPenalty,
        dp[i][j - 1] - gapPenalty
      );
    }
  }

  // Backtracking
  let i = N;
  let j = M;
  const extWordStatus = new Map<number, { status: 'match' | 'partial' | 'mismatch'; refText?: string }>();

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sim = wordSimilarity(extWords[i - 1].tok, refWords[j - 1].tok);
      let matchScore = -1.0;
      if (sim >= 0.85) matchScore = 2.0;
      else if (sim >= 0.5) matchScore = 0.5;

      if (dp[i][j] === dp[i - 1][j - 1] + matchScore) {
        let status: 'match' | 'partial' | 'mismatch' = 'mismatch';
        if (sim >= 0.85) {
          status = 'match';
        } else if (sim >= 0.5) {
          status = 'partial';
        }

        extWordStatus.set(extWords[i - 1].rawIdx, {
          status,
          refText: refWords[j - 1].tok
        });
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] - gapPenalty)) {
      extWordStatus.set(extWords[i - 1].rawIdx, {
        status: 'mismatch',
        refText: ''
      });
      i--;
    } else {
      j--;
    }
  }

  // Construct final token list
  return rawExtractedTokens.map((tok, idx) => {
    const wordInfo = extWordStatus.get(idx);
    if (!wordInfo) {
      return { text: tok, status: 'match' };
    }
    return {
      text: tok,
      status: wordInfo.status,
      refText: wordInfo.refText
    };
  });
}
