import React from 'react';
import { QuizMode } from '../types';

interface MainMenuProps {
  onModeSelect: (mode: QuizMode) => void;
  onReset: () => void;
}

const ModeButton: React.FC<{ title: string; description: string; icon: React.ReactElement; onClick: () => void }> = ({ title, description, icon, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center justify-center text-center w-full sm:w-64 h-48 sm:h-64 p-4 sm:p-6 bg-white rounded-xl shadow-md hover:shadow-xl hover:-translate-y-1 transform transition-all duration-300 border border-slate-200 hover:border-sky-400 min-h-[120px]"
  >
    <div className="text-sky-500 group-hover:text-sky-600 transition-colors">{icon}</div>
    <h3 className="text-lg sm:text-xl font-bold mt-3 sm:mt-4 text-slate-800">{title}</h3>
    <p className="text-xs sm:text-sm text-slate-500 mt-2 px-2">{description}</p>
  </button>
);

const MainMenu: React.FC<MainMenuProps> = ({ onModeSelect, onReset }) => {
  return (
    <div className="flex flex-col items-center p-4 sm:p-0">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Chọn chế độ học tập</h2>
        <p className="text-sm sm:text-base text-slate-600 px-4">Bạn muốn học tập hay thử sức trong một bài thi?</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full max-w-lg sm:max-w-none">
        <ModeButton
          title="Học tập"
          description="Ôn luyện theo chủ đề, xem đáp án ngay lập tức."
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          onClick={() => onModeSelect(QuizMode.Study)}
        />
        <ModeButton
          title="Thi cử"
          description="Làm bài thi tính giờ, xem kết quả cuối cùng."
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          onClick={() => onModeSelect(QuizMode.Exam)}
        />
      </div>
      <button
        onClick={onReset}
        className="mt-8 sm:mt-12 text-sm text-slate-500 hover:text-sky-600 hover:underline transition-colors min-h-[44px] px-4 py-2"
      >
        Quay lại chọn cơ sở kiến thức
      </button>
    </div>
  );
};

export default MainMenu;