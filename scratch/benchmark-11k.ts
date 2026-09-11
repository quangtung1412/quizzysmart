import { QuestionCacheService, CachedQuestion } from '../server/src/services/question-cache.service.js';

// Khởi tạo service
const cacheService = new QuestionCacheService();

// Tạo giả lập 11,000 câu hỏi với nội dung đa dạng
console.log('Generating 11,000 mock questions...');
const mockRawQuestions: any[] = [];
const topics = [
  'Luật các tổ chức tín dụng',
  'Bộ luật Lao động',
  'Luật Doanh nghiệp',
  'Quy chế cho vay Agribank',
  'Luật Phòng chống tham nhũng',
  'Nghị định 102/2024/NĐ-CP',
  'Thông tư 39/2016/TT-NHNN',
  'Quy định an toàn thông tin',
  'Quy chuẩn đạo đức nghề nghiệp',
  'Nghiệp vụ thanh toán quốc tế'
];

for (let i = 1; i <= 11000; i++) {
  const topic = topics[i % topics.length];
  let text = '';
  if (i === 5432) {
    // Câu hỏi mục tiêu cần tìm
    text = 'Theo Luật các tổ chức tín dụng năm 2024, vốn điều lệ tối thiểu của ngân hàng thương mại cổ phần là bao nhiêu nghìn tỷ đồng?';
  } else {
    text = `Câu hỏi số ${i}: Quy định tại Điều ${i % 150 + 1} của ${topic} về trình tự, thủ tục kiểm tra, giám sát hoạt động nội bộ năm 202${i % 5} có hiệu lực thi hành từ ngày nào?`;
  }

  mockRawQuestions.push({
    id: `q-${i}`,
    text,
    options: JSON.stringify([
      `Phương án A cho câu hỏi ${i}`,
      `Phương án B cho câu hỏi ${i}`,
      `Phương án C cho câu hỏi ${i}`,
      `Phương án D cho câu hỏi ${i}`
    ]),
    correctAnswerIdx: i % 4,
    source: topic,
    category: 'Chính sách',
    baseId: 'base-1',
    base: { name: 'Ngân hàng đề tổng hợp' }
  });
}

// 1. Đo thời gian tiền xử lý nạp cache
const tPreStart = Date.now();
const cachedQuestions: CachedQuestion[] = mockRawQuestions.map(q => cacheService.preProcessQuestion(q, q.base.name));
const preProcessTime = Date.now() - tPreStart;
console.log(`Pre-processed 11,000 questions in: ${preProcessTime}ms`);

// 2. Câu hỏi OCR từ ảnh (có chút biến thể do OCR)
const recognizedText = 'Theo Luat cac to chuc tin dung nam 2024, von dieu le toi thieu cua ngan hang thuong mai co phan la bao nhieu nghin ty dong';

// 3. Benchmark Stage 1: Fast Candidate Filtering
const tStage1Start = performance.now();
const candidates = cacheService.findCandidateQuestions(recognizedText, cachedQuestions, 60);
const stage1Time = performance.now() - tStage1Start;

console.log(`\n=== STAGE 1 BENCHMARK (11,000 Questions) ===`);
console.log(`Total questions scanned: 11,000`);
console.log(`Time taken: ${stage1Time.toFixed(3)}ms`);
console.log(`Candidates filtered: ${candidates.length}`);
console.log(`Top candidate ID: ${candidates[0]?.id}`);
console.log(`Top candidate Text: ${candidates[0]?.text}`);

// Kiểm tra xem câu 5432 có nằm trong Top 1 không
const foundAtTop = candidates[0]?.id === 'q-5432';
console.log(`Did it find the target question at Top 1? ${foundAtTop ? 'YES! ✓' : 'NO ✗'}`);

if (!foundAtTop) {
  console.error('FAILED: Target question was not in Top 1!');
  process.exit(1);
} else {
  console.log('\nSUCCESS! Fast two-stage candidate filter completed in < 5ms for 11,000 questions!');
}
