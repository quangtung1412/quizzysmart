import React, { useState, useEffect } from 'react';
import { api } from '../src/api';
import { AppUser, Question, UserAnswer } from '../types';

interface AttemptDetailScreenProps {
  attemptId: string;
  user: AppUser;
  onBack: () => void;
}

interface QuizResult {
  question: Question;
  userAnswer: UserAnswer;
}

const AttemptDetailScreen: React.FC<AttemptDetailScreenProps> = ({
  attemptId,
  user,
  onBack
}) => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadAttemptDetails();
  }, [attemptId]);

  const loadAttemptDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiResults = await api.getQuizResults(attemptId, user.email);
      setResults(apiResults.results);
      setAttemptInfo({
        id: apiResults.attemptId,
        score: apiResults.score,
        completedAt: apiResults.completedAt
      });
      
    } catch (err: any) {
      console.error('Failed to load attempt details:', err);
      setError(err.message || 'Không thể tải chi tiết lượt thi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div>
        <p className="text-slate-600">Đang tải chi tiết lượt thi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-500 mb-4">❌ Có lỗi xảy ra</div>
        <p className="text-slate-600 mb-6">{error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const correctCount = results.filter(r => r.userAnswer?.isCorrect).length;
  const totalCount = results.length;
  const score = attemptInfo?.score || 0;

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto">
      {/* Header */}
      <div className="w-full flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-transparent rounded-md hover:bg-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Chi tiết lượt thi</h2>
          <p className="text-slate-600">
            {attemptInfo?.completedAt && `Hoàn thành lúc: ${new Date(attemptInfo.completedAt).toLocaleString('vi-VN')}`}
          </p>
        </div>
      </div>

      {/* Score Summary */}
      <div className="my-8 w-full max-w-sm bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
        <p className="text-lg text-slate-600">Điểm số</p>
        <p className={`text-6xl font-bold my-2 ${
          score >= 80 ? 'text-green-600' : 
          score >= 50 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {score}%
        </p>
        <p className="text-lg font-medium text-slate-700">
          {correctCount} / {totalCount} câu trả lời đúng
        </p>
      </div>

      {/* Toggle Details Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-8 py-3 text-sm font-medium text-sky-700 bg-sky-100 border border-transparent rounded-md hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
        >
          {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết'}
        </button>
      </div>

      {/* Detailed Results */}
      {showDetails && (
        <div className="w-full border-t pt-6">
          <h3 className="text-xl font-semibold text-slate-700 mb-4">Xem lại bài làm</h3>
          <div className="space-y-6">
            {results.map((result, index) => {
              const { question: q, userAnswer } = result;
              const selectedOption = userAnswer?.selectedOptionIndex;
              const correctOption = q.correctAnswerIndex;
              
              return (
                <div key={q.id} className="p-4 bg-white rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">{`Câu ${index + 1}: ${q.question}`}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {q.options.map((option, optIndex) => {
                      const isSelected = optIndex === selectedOption;
                      const isCorrect = optIndex === correctOption;
                      
                      let optionClass = "flex items-center justify-between p-2 rounded border-2";
                      let statusText = "";
                      
                      if (isSelected && isCorrect) {
                        // Selected correct answer
                        optionClass += " bg-green-100 border-green-500 text-green-900 font-medium";
                        statusText = "✓ Bạn chọn đúng";
                      } else if (isSelected && !isCorrect) {
                        // Selected wrong answer
                        optionClass += " bg-red-100 border-red-500 text-red-900 font-medium";
                        statusText = "✗ Bạn chọn sai";
                      } else if (!isSelected && isCorrect) {
                        // Correct answer not selected
                        optionClass += " bg-green-50 border-green-300 text-green-800";
                        statusText = "✓ Đáp án đúng";
                      } else {
                        // Not selected, not correct
                        optionClass += " bg-slate-50 border-slate-200 text-slate-600";
                      }

                      return (
                        <div key={optIndex} className={optionClass}>
                          <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                          {statusText && (
                            <span className="text-xs font-bold">{statusText}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {q.source && (
                    <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">Nguồn: {q.source}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttemptDetailScreen;
