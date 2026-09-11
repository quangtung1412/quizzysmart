import { QuestionCacheService, CachedQuestion } from '../server/src/services/question-cache.service.js';

function computeLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let m = a.length;
  let n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  if (m < n) {
    const tmpStr = a; a = b; b = tmpStr;
    const tmpLen = m; m = n; n = tmpLen;
  }

  let prev = new Int32Array(n + 1);
  let curr = new Int32Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const charA = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = charA === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

function cleanOptionText(text: string): string {
  if (!text) return '';
  return text.trim()
    .replace(/^(\([A-Da-d0-9]\)|[A-Da-d0-9][\.\)\:\/\-–—]\s*)/, '')
    .trim();
}

function normalizeForComparison(text: string): string {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeTextSimilarity(text1: string, text2: string): number {
  const s1 = normalizeForComparison(cleanOptionText(text1));
  const s2 = normalizeForComparison(cleanOptionText(text2));
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = computeLevenshtein(s1, s2);
  const levSim = maxLen > 0 ? Math.max(0, 1 - dist / maxLen) : 0;
  return levSim;
}

function calculateQuestionMatchScore(
  dbQuestionText: string,
  dbOptions: string[],
  recognizedQuestion: string,
  extractedOptionsList: string[],
  preNormalizedDbText?: string,
  preNormalizedNumbers?: string[]
) {
  const qNorm = preNormalizedDbText || normalizeForComparison(dbQuestionText);
  const rNorm = normalizeForComparison(recognizedQuestion);

  let questionMatchScore = 0;
  if (qNorm === rNorm) {
    questionMatchScore = 1.0;
  } else {
    const qNums = preNormalizedNumbers || qNorm.match(/\b\d+\b/g) || [];
    const rNums = rNorm.match(/\b\d+\b/g) || [];
    let numberPenalty = 1.0;
    if (qNums.length > 0 || rNums.length > 0) {
      if (qNums.slice().sort().join(',') !== rNums.slice().sort().join(',')) {
        numberPenalty = 0.35;
      }
    }

    const maxLen = Math.max(qNorm.length, rNorm.length);
    const dist = computeLevenshtein(qNorm, rNorm);
    const levSim = maxLen > 0 ? Math.max(0, 1 - dist / maxLen) : 0;

    const qWords = qNorm.split(' ').filter(w => w.length > 1);
    const rWords = rNorm.split(' ').filter(w => w.length > 1);
    const commonWords = qWords.filter(w => rWords.includes(w));
    const jaccard = maxLen > 0 ? commonWords.length / Math.max(qWords.length, rWords.length) : 0;

    questionMatchScore = (levSim * 0.65 + jaccard * 0.35) * numberPenalty;
  }

  let optionsMatchScore = 0;
  const validExtractedOptions = extractedOptionsList
    .map(opt => cleanOptionText(opt))
    .filter(opt => opt.length > 0);

  if (validExtractedOptions.length > 0 && questionMatchScore >= 0.25) {
    let totalOptionScore = 0;
    for (const extOpt of validExtractedOptions) {
      let bestOptMatch = 0;
      for (const dbOpt of dbOptions) {
        const sim = computeTextSimilarity(extOpt, dbOpt);
        if (sim > bestOptMatch) bestOptMatch = sim;
      }
      totalOptionScore += bestOptMatch;
    }
    optionsMatchScore = Math.min(1.0, totalOptionScore / validExtractedOptions.length);
  }

  const matchScore = validExtractedOptions.length >= 2
    ? (questionMatchScore * 0.6) + (optionsMatchScore * 0.4)
    : questionMatchScore;

  return { matchScore, questionMatchScore, optionsMatchScore };
}

// Khởi tạo 11,000 câu hỏi
const cacheService = new QuestionCacheService();
const mockQuestions: any[] = [];
for (let i = 1; i <= 11000; i++) {
  let text = i === 8888
    ? 'Theo quy định hiện hành, thời hạn tối đa của một hợp đồng lao động xác định thời hạn là bao nhiêu tháng?'
    : `Câu hỏi ${i}: Quy định về điều kiện cấp giấy phép hoạt động năm 2024 theo Thông tư số ${i % 100}?`;

  mockQuestions.push({
    id: `q-${i}`,
    text,
    options: JSON.stringify(['12 tháng', '24 tháng', '36 tháng', '48 tháng']),
    correctAnswerIdx: 2,
    source: 'Luật Lao động',
    category: 'Chung',
    baseId: 'base-1',
    base: { name: 'Cơ sở dữ liệu' }
  });
}

const cachedQuestions = mockQuestions.map(q => cacheService.preProcessQuestion(q, q.base.name));

// Giả lập câu hỏi nhận diện từ ảnh OCR
const recognizedText = 'Theo quy dinh hien hanh, thoi han toi da cua hop dong lao dong xac dinh thoi han la bao nhieu thang?';
const extractedOptionsList = ['12 thang', '24 thang', '36 thang', '48 thang'];

// Đo thời gian End-to-End Matching
const tTotalStart = performance.now();

// Stage 1: Candidate pre-filter
const candidateQuestions = cacheService.findCandidateQuestions(recognizedText, cachedQuestions, 60);

// Stage 2: Fine-grained scoring
const allMatches: any[] = [];
for (const question of candidateQuestions) {
  const { matchScore } = calculateQuestionMatchScore(
    question.text,
    question.options,
    recognizedText,
    extractedOptionsList,
    question.normText,
    question.numbers
  );
  if (matchScore > 0.4) {
    allMatches.push({ question, score: matchScore });
  }
}

allMatches.sort((a, b) => b.score - a.score);
const totalMatchingTime = performance.now() - tTotalStart;

console.log(`\n=== END-TO-END MATCHING BENCHMARK (11,000 Questions) ===`);
console.log(`Total questions in database: 11,000`);
console.log(`Candidates filtered in Stage 1: ${candidateQuestions.length}`);
console.log(`Top match found: ${allMatches[0]?.question.id} (Score: ${(allMatches[0]?.score * 100).toFixed(1)}%)`);
console.log(`Top match text: ${allMatches[0]?.question.text}`);
console.log(`\n>>> TOTAL END-TO-END MATCHING TIME: ${totalMatchingTime.toFixed(2)} ms <<<`);

if (allMatches[0]?.question.id === 'q-8888' && totalMatchingTime < 50) {
  console.log('\nVERIFICATION PASSED: Found correct target in under 50ms (previously 12.54s)!');
} else {
  console.error('\nVERIFICATION FAILED!');
  process.exit(1);
}
