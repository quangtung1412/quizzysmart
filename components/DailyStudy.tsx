import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Star, X } from 'lucide-react';
import { StudyPlan, DifficultyLevel } from '../types';
import { useStudyPlanStore } from '../src/hooks/useStudyPlanStore';

export interface DailyStudyProps {
  studyPlan: StudyPlan;
  currentUser: string;
  onBackToOverview: () => void;
}

const DailyStudy: React.FC<DailyStudyProps> = ({ studyPlan: initialPlan, currentUser, onBackToOverview }) => {
  const { getAllHardQuestions, updateQuestionProgress } = useStudyPlanStore(currentUser);
  const [plan, setPlan] = useState(initialPlan);
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ratingMode, setRatingMode] = useState<boolean | 'finished'>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAllHardQuestions(plan.id);
      setQuestions(res.questions);
      setPlan(res.studyPlan);
      if (!res.questions.length) {
        setError('Không có câu hỏi nào để học.');
      }
    } catch {
      setError('Lỗi tải câu hỏi.');
    } finally {
      setLoading(false);
    }
  }, [getAllHardQuestions, plan.id]);

  useEffect(() => {
    load();
  }, [load]);

  const q = questions[index];
  const isCorrect = q && selected !== null && parseInt(selected, 10) === q.correctAnswerIndex;

  const handleSelect = (idx: string) => {
    if (!revealed) setSelected(idx);
  };

  const handleCheck = () => {
    if (selected !== null) {
      setRevealed(true);
      setRatingMode(true);
    }
  };

  const handleRate = async (lvl: DifficultyLevel) => {
    if (!q) return;
    try {
      await updateQuestionProgress(plan.id, q.id, lvl);
    } catch {
      // Handle error silently
    }
    if (index < questions.length - 1) {
      setIndex(i => i + 1);
      setSelected(null);
      setRevealed(false);
      setRatingMode(false);
    } else {
      setRatingMode('finished');
    }
  };

  const handleFinishSession = (continueStudy: boolean) => {
    if (continueStudy) {
      load();
      setIndex(0);
      setSelected(null);
      setRevealed(false);
      setRatingMode(false);
    } else {
      onBackToOverview();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-2 sm:p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6">
          <div className="text-center py-8">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-2 sm:p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6">
          <div className="text-center py-8 space-y-4">
            <p className="text-gray-600">{error}</p>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              onClick={onBackToOverview}
            >
              Trở về
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-2 sm:p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6">
          <div className="text-center py-8">Không có câu hỏi.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-1 sm:p-2">
      <div className="max-w-2xl mx-auto bg-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Header - Mobile optimized */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <button
              onClick={onBackToOverview}
              aria-label="Quay lại"
              className="p-2 rounded hover:bg-gray-100 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl truncate">{plan.knowledgeBaseName}</h1>
              <p className="text-xs sm:text-sm text-gray-500">Ôn luyện thông minh</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {q.isReviewed && q.lastReviewed && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 01.672 0 41.059 41.059 0 018.198 5.424.75.75 0 01-.254 1.285 31.372 31.372 0 00-7.86 3.83.75.75 0 01-.84 0 31.508 31.508 0 00-2.08-1.287V9.394c0-.244.116-.463.302-.592a35.504 35.504 0 713.305-2.033.75.75 0 00-.714-1.319 37 37 0 00-3.446 2.12A2.216 2.216 0 006 9.393v.38a31.293 31.293 0 00-4.28-1.746.75.75 0 01-.254-1.285 41.059 41.059 0 018.198-5.424zM6 11.459a29.848 29.848 0 00-2.455-1.158 41.029 41.029 0 00-.39 3.114.75.75 0 00.419.74c.528.256 1.046.53 1.554.82-.21-.899-.455-1.846-.518-2.516zM21.654 4.756a29.842 29.842 0 00-2.455 1.158c-.063.67-.308 1.617-.518 2.516a41.029 41.029 0 001.554-.82.75.75 0 00.419-.74 41.029 41.029 0 00-.39-3.114z" clipRule="evenodd" />
                </svg>
                Đã học {q.reviewCount && `(${q.reviewCount}x)`}
              </span>
            )}
            <div className="text-sm text-gray-600 font-medium">{index + 1}/{questions.length}</div>
          </div>
        </div>

        {/* Question - Mobile optimized */}
        <div className="space-y-2 sm:space-y-3">
          <h2 className="font-semibold text-base sm:text-lg leading-relaxed">{q.question}</h2>
          <div className="space-y-1.5 sm:space-y-2">
            {q.options.map((opt: string, optIdx: number) => {
              const idStr = String(optIdx);
              const sel = selected === idStr;
              const correct = revealed && optIdx === q.correctAnswerIndex;
              const wrongSel = revealed && sel && !correct;
              return (
                <button
                  key={idStr}
                  onClick={() => handleSelect(idStr)}
                  disabled={revealed}
                  className={`w-full text-left border rounded-lg px-2.5 sm:px-3 py-2.5 flex justify-between items-center transition text-sm sm:text-base ${correct ? 'border-green-500 bg-green-50' : ''
                    }${wrongSel ? 'border-red-500 bg-red-50' : ''}${!revealed && sel ? 'border-blue-500 bg-blue-50' : ''
                    }${!revealed && !sel ? 'border-gray-200 hover:bg-gray-50' : ''}`}
                >
                  <span className="leading-relaxed">{opt}</span>
                  {correct && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 ml-2" />}
                  {wrongSel && <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        {revealed && q.explanation && (
          <div className="p-2.5 sm:p-3 bg-gray-50 rounded-lg border text-sm text-gray-700">
            <strong>Giải thích:</strong> {q.explanation}
          </div>
        )}

        {/* Bottom section - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          <div className="text-sm text-center sm:text-left">
            {revealed ? (
              isCorrect ? (
                <span className="text-green-600 font-medium">✅ Chính xác!</span>
              ) : (
                <span className="text-red-600 font-medium">❌ Chưa đúng</span>
              )
            ) : (
              'Chọn đáp án của bạn'
            )}
          </div>
          {!ratingMode && (
            <button
              onClick={handleCheck}
              disabled={selected === null}
              className={`px-4 sm:px-5 py-2 rounded-lg text-white font-medium w-full sm:w-auto ${selected === null ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              Kiểm tra
            </button>
          )}
        </div>

        {/* Rating mode - Mobile optimized */}
        {ratingMode === true && (
          <div className="space-y-3">
            <div className="text-center">
              <Star className="w-7 h-7 sm:w-9 sm:h-9 text-yellow-500 mx-auto mb-2" />
              <p className="font-semibold text-sm sm:text-base">Độ khó câu hỏi này?</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleRate(DifficultyLevel.Easy)}
                className="p-3 border-2 border-green-200 rounded-lg hover:border-green-400 text-sm sm:text-base font-medium bg-green-50 hover:bg-green-100"
              >
                😊 Dễ
              </button>
              <button
                onClick={() => handleRate(DifficultyLevel.Medium)}
                className="p-3 border-2 border-yellow-200 rounded-lg hover:border-yellow-400 text-sm sm:text-base font-medium bg-yellow-50 hover:bg-yellow-100"
              >
                🤔 Trung bình
              </button>
              <button
                onClick={() => handleRate(DifficultyLevel.Hard)}
                className="p-3 border-2 border-red-200 rounded-lg hover:border-red-400 text-sm sm:text-base font-medium bg-red-50 hover:bg-red-100"
              >
                😰 Khó
              </button>
            </div>
          </div>
        )}

        {/* Finished mode - Mobile optimized */}
        {ratingMode === 'finished' && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
              <h3 className="font-semibold text-green-800 mb-2 text-lg">🎉 Hoàn thành phiên học!</h3>
              <p className="text-green-700 text-sm">Bạn đã học xong số câu hỏi dự định hôm nay.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleFinishSession(true)}
                className="p-3 border-2 border-blue-200 bg-blue-50 rounded-lg hover:border-blue-400 hover:bg-blue-100 font-medium text-blue-800"
              >
                📚 Học vượt thêm
              </button>
              <button
                onClick={() => handleFinishSession(false)}
                className="p-3 border-2 border-gray-200 bg-white rounded-lg hover:border-gray-400 hover:bg-gray-50 font-medium text-gray-700"
              >
                ✅ Hoàn thành
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyStudy;
