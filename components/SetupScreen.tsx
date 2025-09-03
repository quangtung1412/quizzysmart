
import React, { useState, useMemo } from 'react';
import { QuizMode, Question, QuizSettings } from '../types';

interface SetupScreenProps {
  mode: QuizMode;
  allQuestions: Question[];
  onStartQuiz: (settings: QuizSettings) => void;
  onBack: () => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ mode, allQuestions, onStartQuiz, onBack }) => {
  const uniqueCategories = useMemo(() => {
    const categories = new Set(allQuestions.map(q => q.category));
    return Array.from(categories);
  }, [allQuestions]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timeLimit, setTimeLimit] = useState<number>(10); // in minutes
  const [showAllCategories, setShowAllCategories] = useState(false);

  const maxQuestions = useMemo(() => {
    if (selectedCategories.length === 0) {
      return allQuestions.length;
    }
    return allQuestions.filter(q => selectedCategories.includes(q.category)).length;
  }, [allQuestions, selectedCategories]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalQuestionCount = Math.min(questionCount, maxQuestions);
    onStartQuiz({
      categories: selectedCategories,
      questionCount: finalQuestionCount > 0 ? finalQuestionCount : 1,
      timeLimit: timeLimit * 60, // convert minutes to seconds
    });
  };

  const displayedCategories = showAllCategories ? uniqueCategories : uniqueCategories.slice(0, 5);

  return (
    <div className="flex flex-col items-center p-4 sm:p-0">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
          Cài đặt bài {mode === QuizMode.Study ? 'học' : 'thi'}
        </h2>
        <p className="text-sm sm:text-base text-slate-600">
          Chế độ: <span className="font-medium text-sky-600">{mode === QuizMode.Study ? 'Học tập' : 'Thi cử'}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 sm:space-y-6">
        {mode === QuizMode.Study && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 sm:mb-3">Chọn mảng kiến thức (tùy chọn)</label>
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 max-h-48 sm:max-h-56 overflow-y-auto">
              <div className="flex items-center mb-3">
                <input
                  id="all-categories"
                  type="checkbox"
                  checked={selectedCategories.length === 0}
                  onChange={() => setSelectedCategories([])}
                  className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <label htmlFor="all-categories" className="ml-3 block text-sm font-medium text-slate-800 select-none">Tất cả kiến thức</label>
              </div>
              <hr className="my-3 border-slate-200" />
              {displayedCategories.map(category => (
                <div key={category} className="flex items-center mt-2 sm:mt-3">
                  <input
                    id={category}
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                    className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                  />
                  <label htmlFor={category} className="ml-3 block text-sm text-slate-700 select-none leading-relaxed">{category}</label>
                </div>
              ))}
            </div>
            {uniqueCategories.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-sm text-sky-600 hover:text-sky-800 font-medium mt-2 sm:mt-3 min-h-[44px] px-2 py-1"
              >
                {showAllCategories ? 'Ẩn bớt' : `Hiển thị tất cả ${uniqueCategories.length} mục`}
              </button>
            )}
          </div>
        )}

        <div>
          <label htmlFor="question-count" className="block text-sm font-medium text-slate-700 mb-2">Số lượng câu hỏi</label>
          <input
            type="range"
            id="question-count"
            min="1"
            max={maxQuestions}
            value={questionCount > maxQuestions ? maxQuestions : questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
            className="w-full h-11 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2 sm:mt-3 touch-manipulation"
          />
          <div className="flex justify-between text-xs sm:text-sm text-slate-500 mt-2">
            <span>1</span>
            <span className="font-bold text-sky-600 text-sm sm:text-base">{Math.min(questionCount, maxQuestions)} / {maxQuestions}</span>
            <span>{maxQuestions}</span>
          </div>
        </div>

        <div>
          <label htmlFor="time-limit" className="block text-sm font-medium text-slate-700 mb-2">Thời gian (phút)</label>
          <input
            type="number"
            id="time-limit"
            min="1"
            max="180"
            value={timeLimit}
            onChange={(e) => setTimeLimit(parseInt(e.target.value, 10))}
            className="mt-1 block w-full px-3 sm:px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm sm:text-base min-h-[44px]"
            inputMode="numeric"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-4 sm:pt-6">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-4 sm:px-6 py-3 text-sm sm:text-base font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors min-h-[44px]"
          >
            Quay lại
          </button>
          <button
            type="submit"
            disabled={maxQuestions === 0}
            className="w-full sm:w-auto px-6 sm:px-8 py-3 text-sm sm:text-base font-medium text-white bg-sky-600 border border-transparent rounded-lg shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            Bắt đầu
          </button>
        </div>
        {maxQuestions === 0 && (
          <div className="text-center">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              Không có câu hỏi nào cho lựa chọn kiến thức này.
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default SetupScreen;
