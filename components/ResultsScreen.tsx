import React, { useMemo, useState, useEffect } from 'react';
import { Question, UserAnswer } from '../types';
import { api } from '../src/api';

interface ResultsScreenProps {
  questions: Question[];
  userAnswers: UserAnswer[];
  attemptId?: string;
  user?: { email: string; name: string };
  onRestart: () => void;
}

interface QuizResult {
  question: Question;
  userAnswer: UserAnswer;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({ questions, userAnswers, attemptId, user, onRestart }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [resultsWithCorrectAnswers, setResultsWithCorrectAnswers] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverScore, setServerScore] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  
  // Fetch quiz results with correct answers from server
  useEffect(() => {
    const fetchQuizResults = async () => {
      if (!attemptId || !user) {
        // Fallback to original logic if no attemptId/user
        const results = questions.map(q => {
          const userAnswer = userAnswers.find(ua => ua.questionId === q.id);
          return {
            question: q,
            userAnswer: userAnswer || { questionId: q.id, selectedOptionIndex: null, isCorrect: null }
          };
        });
        setResultsWithCorrectAnswers(results);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const apiResults = await api.getQuizResults(attemptId, user.email);
        setResultsWithCorrectAnswers(apiResults.results);
        setServerScore(apiResults.score); // Use server-calculated score
        setCompletedAt(apiResults.completedAt); // Get completion time
        setStartedAt((apiResults as any).startedAt); // Get start time (type assertion needed)
      } catch (err) {
        console.error('Failed to fetch quiz results:', err);
        setError('Không thể tải kết quả chi tiết');
        
        // Fallback to original logic
        const results = questions.map(q => {
          const userAnswer = userAnswers.find(ua => ua.questionId === q.id);
          return {
            question: q,
            userAnswer: userAnswer || { questionId: q.id, selectedOptionIndex: null, isCorrect: null }
          };
        });
        setResultsWithCorrectAnswers(results);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuizResults();
  }, [attemptId, user, questions, userAnswers]);

  const { correctCount, totalCount, score } = useMemo(() => {
    // Use server score when available, fallback to client calculation
    if (serverScore !== null) {
      const serverCorrectCount = resultsWithCorrectAnswers.filter(r => r.userAnswer?.isCorrect === true).length;
      return {
        correctCount: serverCorrectCount,
        totalCount: resultsWithCorrectAnswers.length || questions.length,
        score: serverScore.toFixed(2)
      };
    }
    
    // Fallback to client-side calculation
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const totalCount = questions.length;
    const score = totalCount > 0 ? ((correctCount / totalCount) * 100).toFixed(2) : 0;
    return { correctCount, totalCount, score };
  }, [userAnswers, questions, serverScore, resultsWithCorrectAnswers]);

  // Calculate completion time if available
  const completionTimeInfo = useMemo(() => {
    if (!completedAt) return null;
    
    const completedTime = new Date(completedAt);
    let duration = null;
    
    // Calculate duration if we have both start and end times
    if (startedAt) {
      const startTime = new Date(startedAt);
      const durationMs = completedTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      const durationSeconds = Math.floor((durationMs % (1000 * 60)) / 1000);
      
      if (durationMinutes > 0) {
        duration = `${durationMinutes} phút ${durationSeconds} giây`;
      } else {
        duration = `${durationSeconds} giây`;
      }
    }
    
    return {
      formattedTime: completedTime.toLocaleString('vi-VN'),
      date: completedTime.toLocaleDateString('vi-VN'),
      time: completedTime.toLocaleTimeString('vi-VN'),
      duration
    };
  }, [completedAt, startedAt]);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold text-slate-800">Kết quả bài thi</h2>
      <p className="text-slate-500 mt-2">Chúc mừng bạn đã hoàn thành!</p>

      {/* Completion time info */}
      {completionTimeInfo && (
        <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-200 text-center">
          <div className="text-sm text-slate-600 space-y-1">
            <p>Hoàn thành lúc: <span className="font-medium text-slate-800">{completionTimeInfo.formattedTime}</span></p>
            {completionTimeInfo.duration && (
              <p>Thời gian làm bài: <span className="font-medium text-blue-600">{completionTimeInfo.duration}</span></p>
            )}
          </div>
        </div>
      )}

      <div className="my-8 w-full max-w-sm bg-slate-50 p-6 rounded-xl border border-slate-200 text-center">
        <p className="text-lg text-slate-600">Điểm số của bạn</p>
        <p className={`text-6xl font-bold my-2 ${
          parseFloat(score) >= 80 ? 'text-green-600' : 
          parseFloat(score) >= 50 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {score}%
        </p>
        <p className="text-lg font-medium text-slate-700">
          {correctCount} / {totalCount} câu trả lời đúng
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onRestart}
          className="px-8 py-3 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
        >
          Chọn bài khác
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-8 py-3 text-sm font-medium text-sky-700 bg-sky-100 border border-transparent rounded-md hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
        >
          {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết'}
        </button>
      </div>
      
      {showDetails && (
        <div className="mt-10 w-full border-t pt-6">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">Xem lại bài làm</h3>
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
                <p className="mt-2 text-slate-600">Đang tải kết quả chi tiết...</p>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-700">{error}</p>
              </div>
            )}
            <div className="space-y-6">
                {resultsWithCorrectAnswers.map((result, index) => {
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
                             <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">Nguồn: {q.source}</p>
                        </div>
                    );
                })}
            </div>
        </div>
      )}
    </div>
  );
};

export default ResultsScreen;