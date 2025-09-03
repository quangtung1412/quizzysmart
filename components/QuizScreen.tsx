import React, { useState, useEffect, useCallback } from 'react';
import { Question, QuizSettings, QuizMode, UserAnswer } from '../types';

interface QuizScreenProps {
  questions: Question[];
  settings: QuizSettings;
  mode: QuizMode;
  testName?: string; // Tên bài thi
  maxAttempts?: number; // Số lượt thi tối đa
  currentAttempt?: number; // Lượt thi hiện tại
  onQuizComplete: (answers: UserAnswer[]) => void;
  onAnswerUpdate: (answers: UserAnswer[]) => void;
}

const Timer: React.FC<{ initialTimeMinutes: number; onTimeUp: () => void }> = ({ initialTimeMinutes, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeMinutes * 60); // Convert minutes to seconds

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }
    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, onTimeUp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={`font-mono text-sm sm:text-lg font-bold px-2 sm:px-3 py-1.5 sm:py-1 rounded-md ${timeLeft < 300 ? 'text-red-600 bg-red-100' : 'text-slate-700 bg-slate-100'} min-w-[60px] sm:min-w-[80px] text-center`}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
};

const QuizScreen: React.FC<QuizScreenProps> = ({
  questions,
  settings,
  mode,
  testName,
  maxAttempts,
  currentAttempt,
  onQuizComplete,
  onAnswerUpdate
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>(() => questions.map(q => ({ questionId: q.id, selectedOptionIndex: null, isCorrect: null })));
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.find(a => a.questionId === currentQuestion.id);

  const handleTimeUp = useCallback(() => {
    onQuizComplete(answers);
  }, [answers, onQuizComplete]);

  const handleAnswerSelect = (optionIndex: number) => {
    if (mode === QuizMode.Study && showFeedback) return;

    // For test mode, don't validate on client side - let server validate
    const isCorrect = mode === QuizMode.Test ? null : optionIndex === currentQuestion.correctAnswerIndex;
    const updatedAnswers = answers.map(a =>
      a.questionId === currentQuestion.id
        ? { ...a, selectedOptionIndex: optionIndex, isCorrect }
        : a
    );

    setAnswers(updatedAnswers);
    onAnswerUpdate(updatedAnswers);

    if (mode === QuizMode.Study) {
      setShowFeedback(true);
    }
  };

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowFeedback(false);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowFeedback(false);
    }
  };

  const goToQuestion = (index: number) => {
    setCurrentIndex(index);
    setShowFeedback(false);
    setShowAllQuestions(false);
  };

  const handleSubmit = () => {
    onQuizComplete(answers);
  };

  // Component cho hiển thị tất cả câu hỏi
  const QuestionOverview = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-800">Tổng quan câu hỏi</h3>
          <button
            onClick={() => setShowAllQuestions(false)}
            className="text-slate-500 hover:text-slate-700 p-1"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {questions.map((_, index) => {
            const answer = answers.find(a => a.questionId === questions[index].id);
            const isAnswered = answer?.selectedOptionIndex !== null;
            const isCurrent = index === currentIndex;

            return (
              <button
                key={index}
                onClick={() => goToQuestion(index)}
                className={`
                  w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all min-h-[44px] sm:min-h-[40px]
                  ${isCurrent ? 'border-sky-500 bg-sky-100 text-sky-700' :
                    isAnswered ? 'border-green-500 bg-green-100 text-green-700' :
                      'border-slate-300 bg-white text-slate-500 hover:border-slate-400'}
                `}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-100 mr-2"></div>
            <span>Đã trả lời</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white mr-2"></div>
            <span>Chưa trả lời</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded border-2 border-sky-500 bg-sky-100 mr-2"></div>
            <span>Câu hiện tại</span>
          </div>
        </div>
      </div>
    </div>
  );

  const getOptionClasses = (optionIndex: number) => {
    const base = "w-full text-left p-4 my-2 border rounded-lg transition-all duration-200 cursor-pointer flex items-center";
    const selected = currentAnswer?.selectedOptionIndex === optionIndex;

    if (mode === QuizMode.Study && showFeedback) {
      const isCorrect = optionIndex === currentQuestion.correctAnswerIndex;
      if (isCorrect) return `${base} bg-green-100 border-green-500 text-green-800 ring-2 ring-green-500`;
      if (selected && !isCorrect) return `${base} bg-red-100 border-red-500 text-red-800`;
      return `${base} bg-white border-slate-300 text-slate-700 cursor-not-allowed`;
    }

    if (selected) return `${base} bg-sky-100 border-sky-500 ring-2 ring-sky-500 text-sky-800`;
    return `${base} bg-white border-slate-300 hover:bg-slate-50 hover:border-sky-400`;
  };

  const isLastQuestion = currentIndex === questions.length - 1;

  const renderRightButton = () => {
    if (mode === QuizMode.Study) {
      if (isLastQuestion) {
        return (
          <button
            onClick={handleSubmit}
            disabled={!showFeedback}
            className="flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed min-h-[44px]"
          >
            Nộp bài
          </button>
        );
      }
      return (
        <button
          onClick={goToNext}
          disabled={!showFeedback}
          className="flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed min-h-[44px]"
        >
          Câu tiếp
        </button>
      );
    }

    // Exam Mode
    if (isLastQuestion) {
      return (
        <button onClick={handleSubmit} className="flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 min-h-[44px]">
          Nộp bài
        </button>
      );
    }
    return (
      <button onClick={goToNext} className="flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 min-h-[44px]">
        Câu tiếp
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {showAllQuestions && <QuestionOverview />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 border-b pb-4 gap-4 sm:gap-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-sky-700 truncate">
            {mode === QuizMode.Study ? 'Chế độ Học tập' : (testName || 'Chế độ Thi')}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
            <span>Câu hỏi {currentIndex + 1} / {questions.length}</span>
            {maxAttempts && currentAttempt && (
              <span>Lượt thi: {currentAttempt} / {maxAttempts}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setShowAllQuestions(true)}
            className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 min-h-[44px] sm:min-h-[auto]"
          >
            <span className="hidden sm:inline">Xem tất cả</span>
            <span className="sm:hidden">Tất cả</span>
          </button>
          <Timer initialTimeMinutes={settings.timeLimit} onTimeUp={handleTimeUp} />
        </div>
      </div>

      <div className="mb-6">
        <p className="text-base sm:text-lg font-semibold text-slate-800 mb-4 sm:mb-6 leading-relaxed">
          {`Câu ${currentIndex + 1}: ${currentQuestion.question}`}
        </p>
        <div className="space-y-2 sm:space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={getOptionClasses(index)}
              disabled={mode === QuizMode.Study && showFeedback}
            >
              <span className="flex-shrink-0 h-6 w-6 sm:h-7 sm:w-7 rounded-full border-2 border-slate-400 flex items-center justify-center mr-3 sm:mr-4 font-bold text-xs sm:text-sm">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-sm sm:text-base text-left leading-relaxed">{option}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === QuizMode.Study && showFeedback && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-700 text-sm sm:text-base">Giải thích:</h4>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">Trích dẫn nguồn: {currentQuestion.source}</p>
        </div>
      )}

      <div className="mt-6 sm:mt-8 pt-4 border-t flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 sm:gap-0">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="px-4 sm:px-6 py-2.5 sm:py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            Câu trước
          </button>
          <button
            onClick={() => setShowAllQuestions(true)}
            className="px-3 sm:px-4 py-2.5 sm:py-2 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-300 rounded-md hover:bg-sky-100 min-h-[44px]"
          >
            <span className="hidden sm:inline">Xem tổng quan</span>
            <span className="sm:hidden">Tổng quan</span>
          </button>
        </div>

        {renderRightButton()}
      </div>
    </div>
  );
};

export default QuizScreen;
