
import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Question } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface FileUploadProps {
  onSaveNewBase: (name: string, questions: Question[]) => void;
  onBack: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onSaveNewBase, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[] | null>(null);
  const [baseName, setBaseName] = useState('');

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setParsedQuestions(null);
    setFileName(file.name);
    setBaseName(file.name.replace(/\.(xlsx|xls)$/, ''));

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Lấy phạm vi dữ liệu từ worksheet
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      if (range.e.r < 1) {
        throw new Error("File Excel không có dữ liệu hoặc định dạng không đúng.");
      }

      // Đọc dữ liệu trực tiếp từ worksheet theo dòng và cột
      const tableData: any[][] = [];
      for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
        const row: any[] = [];
        // Chỉ lấy 8 cột đầu tiên (A-H)
        for (let colIndex = range.s.c; colIndex <= Math.min(range.e.c, 7); colIndex++) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
          const cell = worksheet[cellAddress];
          row[colIndex] = cell ? cell.v : undefined;
        }
        tableData.push(row);
      }

      // In toàn bộ bảng dữ liệu Excel ra console
      console.log('=== TOÀN BỘ DỮ LIỆU EXCEL ===');
      console.log('Số dòng:', tableData.length);
      console.log('Dữ liệu bảng:');
      tableData.forEach((row, index) => {
        console.log(`Dòng ${index + 1}:`, row);
      });
      console.log('=== KẾT THÚC DỮ LIỆU EXCEL ===');

      const getCorrectAnswerIndex = (value: any): number => {
        if (value === null || value === undefined) return NaN;
        const strValue = String(value).trim().toUpperCase();
        if (strValue.length === 0) return NaN;

        const numericValue = parseInt(strValue, 10);
        if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 4) {
          return numericValue - 1;
        }

        if (strValue.length === 1) {
          const charCode = strValue.charCodeAt(0);
          if (charCode >= 65 && charCode <= 68) { // 'A' to 'D'
            return charCode - 65;
          }
        }

        return NaN;
      };

      const questions: Question[] = tableData.slice(1).map((row: any[], index: number) => {
        // Row schema: [STT, Câu hỏi, Đáp án 1, Đáp án 2, Đáp án 3, Đáp án 4, Đáp án đúng, Trích dẫn]
        // Dữ liệu đã được giới hạn 8 cột khi đọc từ worksheet

        const rawQuestion = row[1]?.toString().trim();
        if (!rawQuestion) return null;

        // Lấy 4 đáp án cố định từ cột 2-5
        const optionCells = [row[2], row[3], row[4], row[5]];
        const options = optionCells
          .map(c => (c === null || c === undefined ? '' : c.toString().trim()))
          .filter(opt => opt.length > 0);

        if (options.length < 2) {
          console.warn(`Bỏ qua dòng ${index + 2} vì ít hơn 2 đáp án hợp lệ.`);
          return null;
        }

        const correctIdxRaw = getCorrectAnswerIndex(row[6]);
        console.log('Correct index for row', index + 2, 'is', correctIdxRaw);

        // Kiểm tra đáp án đúng có hợp lệ không (0-3 cho A-D hoặc 1-4 cho số)
        if (isNaN(correctIdxRaw) || correctIdxRaw < 0 || correctIdxRaw > 3) {
          console.warn(`Bỏ qua dòng ${index + 2} vì đáp án đúng "${row[6]}" không hợp lệ (phải là A-D hoặc 1-4).`);
          return null;
        }

        // Kiểm tra đáp án đúng có tồn tại trong danh sách options không
        if (correctIdxRaw >= options.length) {
          console.warn(`Bỏ qua dòng ${index + 2} vì đáp án đúng "${String.fromCharCode(65 + correctIdxRaw)}" không có trong ${options.length} đáp án có sẵn.`);
          return null;
        }

        const questionData: Question = {
          id: uuidv4(),
          question: rawQuestion,
          options,
          correctAnswerIndex: correctIdxRaw,
          source: row[7]?.toString().trim() || 'Không có',
          category: 'Chung', // Không có cột phân loại trong cấu trúc mới
        };
        return questionData;
      }).filter((q): q is Question => q !== null);

      if (questions.length === 0) {
        throw new Error("Không tìm thấy câu hỏi hợp lệ nào trong file. Vui lòng kiểm tra định dạng cột.");
      }

      setParsedQuestions(questions);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi xử lý file.");
      setFileName(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSave = () => {
    if (baseName.trim() && parsedQuestions) {
      onSaveNewBase(baseName.trim(), parsedQuestions);
    }
  };

  if (parsedQuestions) {
    return (
      <div className="flex flex-col items-center p-4">
        <h2 className="text-2xl font-semibold text-slate-700 mb-2">Lưu cơ sở kiến thức mới</h2>
        <p className="text-slate-500 mb-6 text-center">
          Đã phân tích thành công <span className="font-bold text-sky-600">{parsedQuestions.length}</span> câu hỏi từ file <span className="font-medium text-slate-800">{fileName}</span>.
        </p>
        <div className="w-full max-w-sm">
          <label htmlFor="base-name" className="block text-sm font-medium text-slate-600 mb-2">
            Đặt tên cho bộ câu hỏi này:
          </label>
          <input
            type="text"
            id="base-name"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="Ví dụ: Đề cương Ôn tập Giữa kỳ"
            className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
          />
        </div>
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!baseName.trim()}
            className="px-8 py-2 text-sm font-medium text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            Lưu và Bắt đầu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 relative">
      <button onClick={onBack} className="absolute top-0 left-0 text-sm text-slate-500 hover:text-sky-600 flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Quay lại
      </button>
      <h2 className="text-2xl font-semibold text-slate-700 mb-4">Tạo cơ sở kiến thức mới</h2>
      <p className="text-slate-500 mb-6 max-w-md">
        Tải lên file Excel (.xlsx, .xls). Cấu trúc 8 cột: STT, Câu hỏi, Đáp án 1, Đáp án 2, Đáp án 3, Đáp án 4, Đáp án đúng (1-4 hoặc A-D), Trích dẫn.
      </p>

      <label htmlFor="file-upload" className="w-full max-w-sm cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-8 hover:border-sky-500 hover:bg-sky-50 transition-colors">
        <div className="flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="mt-4 text-sm font-medium text-slate-600">
            {fileName ? fileName : 'Nhấn để chọn file'}
          </span>
          <p className="text-xs text-slate-400 mt-1">{isLoading ? "Đang xử lý..." : "XLSX, XLS"}</p>
        </div>
        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isLoading} />
      </label>

      {isLoading && (
        <div className="mt-4 flex items-center text-sky-600">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Đang tải và phân tích file...</span>
        </div>
      )}

      {error && <p className="mt-4 text-red-500 text-sm font-semibold">{error}</p>}
    </div>
  );
};

export default FileUpload;
