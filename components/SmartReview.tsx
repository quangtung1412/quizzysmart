import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Star, X, RotateCcw, Eye, ArrowLeft, Zap, Clock, Target } from 'lucide-react';
import { StudyPlan, DifficultyLevel, QuestionProgress } from '../types';
import { useStudyPlanStore } from '../src/hooks/useStudyPlanStore';
import { api } from '../src/api';
import ProgressBars from './ProgressBars';
import { calculateStudyProgress } from '../src/utils/progress';

export interface SmartReviewProps {
  studyPlan: StudyPlan;
  currentUser: string;
  onBackToOverview: () => void;
}

interface SmartQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  source?: string;
  category?: string;
  isReviewed: boolean;
  lastReviewed?: string;
  reviewCount: number;
  difficultyLevel?: string;
  daysSinceLastReview?: number;
}

interface QuestionQueue {
  new: SmartQuestion[];
  hard: SmartQuestion[];
  medium: SmartQuestion[];
  easy: SmartQuestion[];
}

const SmartReview: React.FC<SmartReviewProps> = ({ studyPlan: initialPlan, currentUser, onBackToOverview }) => {
  const { updateQuestionProgress } = useStudyPlanStore(currentUser);
  const [plan, setPlan] = useState(initialPlan);

  // Question management
  const [questionQueue, setQuestionQueue] = useState<QuestionQueue>({
    new: [],
    hard: [],
    medium: [],
    easy: []
  });
  const [currentQuestionsList, setCurrentQuestionsList] = useState<SmartQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingHardQuestions, setPendingHardQuestions] = useState<SmartQuestion[]>([]);

  // Study state
  const [newQuestionsAnswered, setNewQuestionsAnswered] = useState(0);
  // Count of consecutive NEW questions since last milestone insertion
  const [newStreak, setNewStreak] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ratingMode, setRatingMode] = useState<boolean | 'finished'>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Study session timer (seconds elapsed since component mounted)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Rating submission state to prevent double clicks and show feedback
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [submittingDifficulty, setSubmittingDifficulty] = useState<DifficultyLevel | null>(null);

  // Centralized progress calculation based on study plan progress, not session queue
  const progressStats = useMemo(() => {
    return calculateStudyProgress(plan.questionProgress);
  }, [plan.questionProgress]);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.getSmartReviewQuestions(plan.id);
      setPlan(res.studyPlan);

      // Rebuild queues so that NEW == questions with lastReviewed == null
      const rebuilt: QuestionQueue = { new: [], hard: [], medium: [], easy: [] };
      const seen = new Set<string>();
      const sourceArrays = [
        res.questions.new || [],
        res.questions.hard || [],
        res.questions.medium || [],
        res.questions.easy || []
      ];
      for (const arr of sourceArrays) {
        for (const q of arr) {
          if (seen.has(q.id)) continue;
          seen.add(q.id);
          if (!q.lastReviewed) {
            rebuilt.new.push(q);
          } else {
            switch (q.difficultyLevel) {
              case DifficultyLevel.Hard:
                rebuilt.hard.push(q);
                break;
              case DifficultyLevel.Medium:
                rebuilt.medium.push(q);
                break;
              case DifficultyLevel.Easy:
                rebuilt.easy.push(q);
                break;
              default:
                // If difficulty missing but lastReviewed exists, treat as medium fallback
                rebuilt.medium.push(q);
            }
          }
        }
      }
      setQuestionQueue(rebuilt);

      // Initialize pending hard from reviewed hard (lastReviewed != null guaranteed here)
      if (rebuilt.hard.length > 0) {
        setPendingHardQuestions(rebuilt.hard.slice());
      }

      // Initialize the current questions list with smart ordering
      const { next } = generateNextStream(rebuilt, 0, []);
      setCurrentQuestionsList(next);

      if (next.length === 0) {
        setError('Tất cả câu hỏi đã hoàn thành!');
      }
    } catch (err) {
      setError('Lỗi tải câu hỏi: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [plan.id]);

  // Timer effect
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (total: number) => {
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Debug: log queue counts (New, pending hard, medium) whenever they change
  useEffect(() => {
    console.log('[SMART_REVIEW] Counts => New:', questionQueue.new.length, 'PendingHard:', pendingHardQuestions.length, 'Medium:', questionQueue.medium.length);
  }, [questionQueue.new.length, pendingHardQuestions.length, questionQueue.medium.length]);

  // Generate next questions based on new streaming logic (no 20-question batch)
  // Strategy:
  // 1. Always prepend pending hard questions (they resurface soon after marking hard)
  // 2. After user has answered milestones (3, 6, 9...) new questions -> insert a hard question next (if available)
  // 3. After 15, 30, 45... new questions -> insert a medium question next (if available)
  // 4. Otherwise take exactly ONE new question
  // 5. If no new left: fallback to hard -> medium -> (few) easy
  interface NextStreamResult {
    next: SmartQuestion[];
    insertedHardMilestone: boolean;
    insertedMediumMilestone: boolean;
    consumedPending: boolean; // whether first pending hard was used
  }

  const generateNextStream = (
    queue: QuestionQueue,
    streak: number,
    pendingHard: SmartQuestion[]
  ): NextStreamResult => {
    const next: SmartQuestion[] = [];
    let insertedHardMilestone = false;
    let insertedMediumMilestone = false;
    let consumedPending = false;

    // // 1. At most one pending hard resurfaced
    // if (pendingHard.length > 0) {
    //   next.push(pendingHard[0]);
    //   consumedPending = true;
    // }

    // 2. Milestones based on streak (not total answered)
    if (streak > 0 && streak % 3 === 0 && queue.hard.length > 0) {
      next.push(queue.hard.shift()!);
      pendingHardQuestions.shift();
      insertedHardMilestone = true;
    }
    if (streak > 0 && streak % 5 === 0 && queue.medium.length > 0) {
      next.push(queue.medium.shift()!);
      insertedMediumMilestone = true;
    }

    // 3. Pull one new question if available
    if (queue.new.length > 0) {
      next.push(queue.new.shift()!);
    } else if (next.length === 0) {
      // 4. Fallback difficulty order
      if (queue.hard.length > 0) next.push(queue.hard.shift()!);
      else if (queue.medium.length > 0) next.push(queue.medium.shift()!);
      else if (queue.easy.length > 0) next.push(queue.easy.shift()!);
    }

    try {
      console.log('[SMART_REVIEW] generateNextStream: result nextLen=', next.length, 'consumedPending=', consumedPending, 'hardMilestone=', insertedHardMilestone, 'mediumMilestone=', insertedMediumMilestone, 'streakUsed=', streak);
    } catch { }
    return { next, insertedHardMilestone, insertedMediumMilestone, consumedPending };
  };

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const currentQuestion = currentQuestionsList[currentIndex];
  const isCorrect = currentQuestion && selected !== null &&
    parseInt(selected, 10) === currentQuestion.correctAnswerIndex;

  const getOptionClasses = (optionIndex: number) => {
    const base = "w-full text-left p-4 my-2 border rounded-lg transition-all duration-200 cursor-pointer flex items-center";
    const isSelected = selected !== null && parseInt(selected, 10) === optionIndex;

    if (revealed) {
      const isCorrectAnswer = optionIndex === currentQuestion.correctAnswerIndex;
      if (isCorrectAnswer) return `${base} bg-green-100 border-green-500 text-green-800 ring-2 ring-green-500`;
      if (isSelected && !isCorrectAnswer) return `${base} bg-red-100 border-red-500 text-red-800`;
      return `${base} bg-white border-slate-300 text-slate-700 cursor-not-allowed`;
    }

    if (isSelected) return `${base} bg-sky-100 border-sky-500 ring-2 ring-sky-500 text-sky-800`;
    return `${base} bg-white border-slate-300 hover:bg-slate-50 hover:border-sky-400`;
  };

  const handleSelect = (idx: string) => {
    if (!revealed) setSelected(idx);
  };

  const handleReveal = () => {
    setRevealed(true);
    setRatingMode(true);
  };

  const handleRate = async (difficulty: DifficultyLevel) => {
    if (!currentQuestion) return;
    if (ratingSubmitting) return; // guard against double tap
    setRatingSubmitting(true);
    setSubmittingDifficulty(difficulty);

    try {
      await updateQuestionProgress(plan.id, currentQuestion.id, difficulty);

      // Update local plan state for real-time progress bar updates
      setPlan(prevPlan => {
        const updatedProgress = [...prevPlan.questionProgress];
        const existingProgressIndex = updatedProgress.findIndex(p => p.questionId === currentQuestion.id);

        const newProgress = {
          id: existingProgressIndex >= 0 ? updatedProgress[existingProgressIndex].id : '',
          questionId: currentQuestion.id,
          studyPlanId: plan.id,
          difficultyLevel: difficulty,
          lastReviewed: new Date().toISOString(),
          reviewCount: (currentQuestion.reviewCount || 0) + 1
        };

        if (existingProgressIndex >= 0) {
          updatedProgress[existingProgressIndex] = newProgress;
        } else {
          updatedProgress.push(newProgress);
        }

        return {
          ...prevPlan,
          questionProgress: updatedProgress
        };
      });

      // Update questionQueue to reflect real-time changes for session management
      setQuestionQueue(prev => {
        const updated = { ...prev };
        const questionId = currentQuestion.id;

        // Remove from old queue if it exists
        ['new', 'hard', 'medium', 'easy'].forEach(key => {
          const queueKey = key as keyof QuestionQueue;
          if (updated[queueKey]) {
            updated[queueKey] = updated[queueKey].filter(q => q.id !== questionId);
          }
        });

        // Add to new queue with updated metadata
        const updatedQuestion = {
          ...currentQuestion,
          isReviewed: true,
          difficultyLevel: difficulty,
          lastReviewed: new Date().toISOString(),
          reviewCount: (currentQuestion.reviewCount || 0) + 1
        };

        if (difficulty === DifficultyLevel.Hard) {
          updated.hard.push(updatedQuestion);
        } else if (difficulty === DifficultyLevel.Medium) {
          updated.medium.push(updatedQuestion);
        } else if (difficulty === DifficultyLevel.Easy) {
          updated.easy.push(updatedQuestion);
        }

        return updated;
      });

      // Mutate current question metadata locally so UI reflects update
      setCurrentQuestionsList(list => list.map((q, i) => i === currentIndex ? {
        ...q,
        isReviewed: true,
        difficultyLevel: difficulty,
        lastReviewed: new Date().toISOString(),
        reviewCount: (q.reviewCount || 0) + 1
      } : q));

      // If user marks Hard -> enqueue for future resurfacing (it now has a lastReviewed timestamp via updates above)
      if (difficulty === DifficultyLevel.Hard) {
        setPendingHardQuestions(prev => [...prev, {
          ...currentQuestion,
          isReviewed: true,
          difficultyLevel: DifficultyLevel.Hard,
          lastReviewed: new Date().toISOString(),
          reviewCount: (currentQuestion.reviewCount || 0) + 1
        }]);
      }

      // Update new counters if this was a previously unseen question
      if (!currentQuestion.isReviewed) {
        setNewQuestionsAnswered(prev => prev + 1); // total stats
        setNewStreak(prev => prev + 1);             // streak for milestone logic
      }

      moveToNextQuestion();
    } catch (err) {
      setError('Lỗi cập nhật tiến độ: ' + (err as Error).message);
    }
    finally {
      setRatingSubmitting(false);
      setSubmittingDifficulty(null);
    }
  };

  const moveToNextQuestion = () => {
    setSelected(null);
    setRevealed(false);
    setRatingMode(false);

    // Streaming approach: we only keep one active question (or any pending inserted ones)
    if (currentIndex + 1 < currentQuestionsList.length) {
      setCurrentIndex(prev => prev + 1);
      return;
    }

    const { next, insertedHardMilestone, insertedMediumMilestone, consumedPending } = generateNextStream(
      questionQueue,
      newStreak,
      pendingHardQuestions
    );

    if (next.length === 0) {
      setRatingMode('finished');
    } else {
      setCurrentQuestionsList(next);
      setCurrentIndex(0);
      // Drop consumed pending hard
      if (consumedPending) {
        setPendingHardQuestions(prev => prev.slice(1));
      }
      // Reset streak if milestone injections happened
      if (insertedHardMilestone || insertedMediumMilestone) {
        setNewStreak(0);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8">
          <RotateCcw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 text-lg">Đang tải câu hỏi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-6 text-lg">{error}</p>
          <button
            onClick={onBackToOverview}
            className="flex items-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Quay lại tổng quan
          </button>
        </div>
      </div>
    );
  }

  if (ratingMode === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-lg">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">
            🎉 Hoàn thành ôn tập!
          </h2>
          <div className="bg-gray-50 rounded-xl p-6 shadow-inner mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center justify-center">
              <Target className="w-5 h-5 mr-2" />
              Thống kê học tập
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{progressStats.total}</div>
                <div className="text-gray-600">Tổng câu hỏi</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-green-600">{newQuestionsAnswered}</div>
                <div className="text-gray-600">Câu mới học</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-red-600">{progressStats.hard}</div>
                <div className="text-gray-600">Câu khó</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="text-2xl font-bold text-yellow-600">{progressStats.medium}</div>
                <div className="text-gray-600">Câu TB</div>
              </div>
            </div>
          </div>
          <button
            onClick={onBackToOverview}
            className="flex items-center mx-auto px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-lg font-semibold"
          >
            <ArrowLeft className="w-6 h-6 mr-3" />
            Quay lại tổng quan
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-6 text-lg">Không có câu hỏi để hiển thị</p>
          <button
            onClick={onBackToOverview}
            className="flex items-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Quay lại tổng quan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Global Progress Bars - Desktop / Tablet (top) */}
      <div className="hidden sm:block w-full px-4 pt-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <ProgressBars
                className="mb-2"
                data={progressStats}
              />
            </div>
            <div className="text-sm text-slate-600 font-medium whitespace-nowrap">
              ⏱ Thời gian: <span className="text-slate-800 font-semibold">{formatElapsed(elapsedSeconds)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Progress Bars - Mobile (fixed bottom) with stats & question status */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 px-3 py-2 backdrop-blur-md bg-white/65 supports-[backdrop-filter]:bg-white/40">
        <div className="mx-auto">
          <ProgressBars
            className="mb-1"
            data={progressStats}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-tight font-medium text-slate-600">
            <div className="flex items-center gap-1 text-slate-700">
              <Clock className="w-3.5 h-3.5" />
              <span>⏱ {formatElapsed(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-green-600" />
              <span>Đã học mới: <span className="text-slate-800 font-semibold">{newQuestionsAnswered}</span></span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-red-600" />
              <span>Chờ ôn: <span className="text-slate-800 font-semibold">{pendingHardQuestions.length}</span></span>
            </div>
            {currentQuestion && (
              currentQuestion.isReviewed ? (
                <div className="flex items-center gap-1 text-blue-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Đã học ({currentQuestion.reviewCount})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-700">
                  <Star className="w-3.5 h-3.5" />
                  <span>Câu mới</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 border-b pb-4">
          <button
            onClick={onBackToOverview}
            className="flex items-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="ml-2 hidden sm:inline">Quay lại</span>
          </button>

          <div className="text-center flex-1 mx-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center justify-center">
              <Zap className="w-6 h-6 mr-2 text-purple-600" />
              <span className="hidden sm:inline">Ôn tập thông minh</span>
              <span className="sm:hidden">Ôn tập</span>
            </h1>
            <div className="hidden sm:flex items-center justify-center gap-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center">
                <Star className="w-4 h-4 mr-1 text-green-600" />
                <span className="hidden sm:inline">Đã học mới: </span>
                <span>{newQuestionsAnswered}</span>
              </div>
              {pendingHardQuestions.length > 0 && (
                <div className="flex items-center text-red-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Chờ ôn: </span>
                  <span>{pendingHardQuestions.length}</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-16"> {/* Balance placeholder */}</div>
        </div>

        {/* Question Status Badge */}
        <div className="hidden sm:flex justify-center mb-6">
          {currentQuestion.isReviewed && currentQuestion.lastReviewed && (
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>Đã học ({currentQuestion.reviewCount} lần)</span>
              {currentQuestion.daysSinceLastReview !== null && (
                <span className="ml-2 text-blue-600">
                  - {currentQuestion.daysSinceLastReview} ngày trước
                </span>
              )}
            </div>
          )}
          {!currentQuestion.isReviewed && (
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
              <Star className="w-4 h-4 mr-2" />
              <span>Câu mới</span>
            </div>
          )}
        </div>

        {/* Question Area - Direct like QuizScreen */}
        <div className="mb-6">
          <p className="text-base sm:text-lg font-semibold text-slate-800 mb-4 sm:mb-6 leading-relaxed">
            {`Câu hỏi: ${currentQuestion.question}`}
          </p>

          <div className="space-y-2 sm:space-y-3">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(idx.toString())}
                disabled={revealed}
                className={getOptionClasses(idx)}
              >
                <span className="flex-shrink-0 h-6 w-6 sm:h-7 sm:w-7 rounded-full border-2 border-slate-400 flex items-center justify-center mr-3 sm:mr-4 font-bold text-xs sm:text-sm">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm sm:text-base text-left leading-relaxed">{option}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Source Citation - Show after reveal */}
        {revealed && currentQuestion.source && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-700 text-sm sm:text-base">Giải thích:</h4>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">Trích dẫn nguồn: {currentQuestion.source}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 sm:mt-8 pt-4 border-t flex justify-center space-x-4">
          {!revealed && (
            <button
              onClick={handleReveal}
              disabled={selected === null}
              className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200 ${selected !== null
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              <Eye className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Xem đáp án</span>
              <span className="sm:hidden">Xem</span>
            </button>
          )}

          {ratingMode === true && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => handleRate(DifficultyLevel.Easy)}
                disabled={ratingSubmitting}
                className={`flex items-center px-4 sm:px-5 py-3 bg-green-600 text-white rounded-xl transition-all duration-200 shadow-lg text-sm sm:text-base font-medium ${ratingSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-700 hover:shadow-xl transform hover:scale-105'}`}
                aria-busy={ratingSubmitting && submittingDifficulty === DifficultyLevel.Easy}
              >
                {submittingDifficulty === DifficultyLevel.Easy && ratingSubmitting ? (
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                )}
                <span className="hidden sm:inline">Dễ</span>
                <span className="sm:hidden">Dễ</span>
              </button>
              <button
                onClick={() => handleRate(DifficultyLevel.Medium)}
                disabled={ratingSubmitting}
                className={`flex items-center px-4 sm:px-5 py-3 bg-yellow-600 text-white rounded-xl transition-all duration-200 shadow-lg text-sm sm:text-base font-medium ${ratingSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-yellow-700 hover:shadow-xl transform hover:scale-105'}`}
                aria-busy={ratingSubmitting && submittingDifficulty === DifficultyLevel.Medium}
              >
                {submittingDifficulty === DifficultyLevel.Medium && ratingSubmitting ? (
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                ) : (
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                )}
                <span className="hidden sm:inline">Trung bình</span>
                <span className="sm:hidden">TB</span>
              </button>
              <button
                onClick={() => handleRate(DifficultyLevel.Hard)}
                disabled={ratingSubmitting}
                className={`flex items-center px-4 sm:px-5 py-3 bg-red-600 text-white rounded-xl transition-all duration-200 shadow-lg text-sm sm:text-base font-medium ${ratingSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-red-700 hover:shadow-xl transform hover:scale-105'}`}
                aria-busy={ratingSubmitting && submittingDifficulty === DifficultyLevel.Hard}
              >
                {submittingDifficulty === DifficultyLevel.Hard && ratingSubmitting ? (
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                )}
                <span className="hidden sm:inline">Khó</span>
                <span className="sm:hidden">Khó</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartReview;
