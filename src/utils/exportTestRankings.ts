import * as XLSX from 'xlsx';

export type RankingExportRow = {
  testName?: string;
  userName?: string;
  userEmail?: string;
  username?: string;
  score?: number;
  startedAt?: string | Date | null;
  durationSeconds?: number | null;
  correctAnswers?: number;
  totalQuestions?: number;
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

/** Build and download an Excel file of test ranking results. Multiple tests → one sheet. */
export function exportTestRankingsToExcel(
  rows: RankingExportRow[],
  filename = `ket-qua-bai-thi-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const sheetRows = rows.map((r, idx) => ({
    STT: idx + 1,
    'Bài thi': r.testName || '',
    'Họ tên': r.userName || '',
    Email: r.userEmail || '',
    Username: r.username || '',
    'Điểm (%)': r.score != null ? Number(Number(r.score).toFixed(2)) : '',
    'Câu đúng': r.correctAnswers ?? '',
    'Tổng câu': r.totalQuestions ?? '',
    'Đúng/Tổng':
      r.correctAnswers != null && r.totalQuestions != null
        ? `${r.correctAnswers}/${r.totalQuestions}`
        : '',
    'Thời gian bắt đầu': formatDateTime(r.startedAt),
    'Thời gian làm bài': formatDuration(r.durationSeconds),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ket qua');
  XLSX.writeFile(workbook, filename);
}

export function formatDurationDisplay(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  return formatDuration(seconds);
}
