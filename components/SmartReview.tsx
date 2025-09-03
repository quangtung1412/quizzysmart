import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Star, X, RotateCcw } from 'lucide-react';
import { StudyPlan, DifficultyLevel } from '../types';
import { useStudyPlanStore } from '../src/hooks/useStudyPlanStore';
import { api } from '../src/api';

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
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ratingMode, setRatingMode] = useState<boolean | 'finished'>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    hard: 0,
    medium: 0,
    easy: 0
  });

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await api.getSmartReviewQuestions(plan.id);
      
      setQuestionQueue(res.questions);
      setStats(res.stats);
      setPlan(res.studyPlan);
      
      // Initialize the current questions list with smart ordering
      const initialList = generateNextQuestions(res.questions, 0, []);
      setCurrentQuestionsList(initialList);
      
      if (initialList.length === 0) {
        setError('Tất cả câu hỏi đã hoàn thành!');
      }
    } catch (err) {
      setError('Lỗi tải câu hỏi: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [plan.id]);

  // Generate next batch of questions based on smart review logic
  const generateNextQuestions = (
    queue: QuestionQueue,
    answeredNewQuestions: number,
    pendingHard: SmartQuestion[]
  ): SmartQuestion[] => {
    const questions: SmartQuestion[] = [];
    let newCount = answeredNewQuestions;
    
    // Add any pending hard questions first
    questions.push(...pendingHard);
    
    // If we have new questions, prioritize them
    if (queue.new.length > 0) {
      const batch = Math.min(20, queue.new.length); // Process in batches of 20
      
      for (let i = 0; i < batch; i++) {
        if (queue.new.length === 0) break;
        
        // Add a new question
        questions.push(queue.new.shift()!);
        newCount++;
        
        // Every 10 new questions, insert a hard question
        if (newCount % 10 === 0 && queue.hard.length > 0) {
          questions.push(queue.hard.shift()!);
        }
        
        // Every 15 new questions, insert a medium question  
        if (newCount % 15 === 0 && queue.medium.length > 0) {
          questions.push(queue.medium.shift()!);
        }
      }
    } else {
      // No new questions left, focus on hard and medium
      const hardBatch = Math.min(10, queue.hard.length);
      const mediumBatch = Math.min(5, queue.medium.length);
      
      questions.push(...queue.hard.splice(0, hardBatch));
      questions.push(...queue.medium.splice(0, mediumBatch));
      
      // If still not enough questions and we have easy ones
      if (questions.length < 10 && queue.easy.length > 0) {
        questions.push(...queue.easy.splice(0, 5));
      }
    }
    
    return questions;
  };

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const currentQuestion = currentQuestionsList[currentIndex];
  const isCorrect = currentQuestion && selected !== null && 
    parseInt(selected, 10) === currentQuestion.correctAnswerIndex;

  const handleSelect = (idx: string) => {
    if (!revealed) setSelected(idx);
  };

  const handleReveal = () => {
    setRevealed(true);
    setRatingMode(true);
  };

  const handleRate = async (difficulty: DifficultyLevel) => {
    if (!currentQuestion) return;

    try {
      await updateQuestionProgress(plan.id, currentQuestion.id, difficulty);

      // If marked as hard, add to pending queue for next 10 questions
      if (difficulty === DifficultyLevel.Hard) {
        setPendingHardQuestions(prev => [...prev, currentQuestion]);
      }

      // Update new questions counter
      if (!currentQuestion.isReviewed) {
        setNewQuestionsAnswered(prev => prev + 1);
      }

      moveToNextQuestion();
    } catch (err) {
      setError('Lỗi cập nhật tiến độ: ' + (err as Error).message);
    }
  };

  const moveToNextQuestion = () => {
    setSelected(null);
    setRevealed(false);
    setRatingMode(false);

    if (currentIndex + 1 < currentQuestionsList.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Need to generate more questions
      const remaining = generateNextQuestions(
        questionQueue,
        newQuestionsAnswered,
        pendingHardQuestions
      );
      
      if (remaining.length === 0) {
        setRatingMode('finished');
      } else {
        setCurrentQuestionsList(remaining);
        setCurrentIndex(0);
        setPendingHardQuestions([]); // Clear pending after adding to queue
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Đang tải câu hỏi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={onBackToOverview}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quay lại tổng quan
          </button>
        </div>
      </div>
    );
  }

  if (ratingMode === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Hoàn thành ôn tập!</h2>
          <div className="bg-white rounded-lg p-6 shadow-lg mb-6 max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-4">Thống kê học tập</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Tổng số câu hỏi:</span>
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Câu mới đã học:</span>
                <span className="font-medium">{newQuestionsAnswered}</span>
              </div>
              <div className="flex justify-between">
                <span>Câu khó cần ôn:</span>
                <span className="font-medium">{stats.hard}</span>
              </div>
              <div className="flex justify-between">
                <span>Câu trung bình:</span>
                <span className="font-medium">{stats.medium}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onBackToOverview}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quay lại tổng quan
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Không có câu hỏi để hiển thị</p>
          <button
            onClick={onBackToOverview}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quay lại tổng quan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBackToOverview}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <X className="w-5 h-5 mr-2" />
            Quay lại
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Ôn tập thông minh</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>Câu {currentIndex + 1} / {currentQuestionsList.length}</span>
              <span>|</span>
              <span>Đã học mới: {newQuestionsAnswered}</span>
              {pendingHardQuestions.length > 0 && (
                <>
                  <span>|</span>
                  <span className="text-red-600">Chờ ôn: {pendingHardQuestions.length}</span>
                </>
              )}
            </div>
          </div>
          <div className="w-20"> {/* Placeholder for balance */}</div>
        </div>

        {/* Question Status Badge */}
        <div className="flex justify-center mb-4">
          {currentQuestion.isReviewed && currentQuestion.lastReviewed && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Đã học ({currentQuestion.reviewCount} lần)
              {currentQuestion.daysSinceLastReview !== null && (
                <span className="ml-1">
                  - {currentQuestion.daysSinceLastReview} ngày trước
                </span>
              )}
            </div>
          )}
          {!currentQuestion.isReviewed && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Star className="w-3 h-3 mr-1" />
              Câu mới
            </div>
          )}
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-6 leading-relaxed">
            {currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selected === idx.toString();
              const isCorrectAnswer = idx === currentQuestion.correctAnswerIndex;
              const showCorrect = revealed && isCorrectAnswer;
              const showIncorrect = revealed && isSelected && !isCorrectAnswer;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx.toString())}
                  disabled={revealed}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    showCorrect
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : showIncorrect
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                  } ${revealed ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-xs font-medium mr-3">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {showCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {showIncorrect && <XCircle className="w-5 h-5 text-red-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center mt-6 space-x-4">
            {!revealed && (
              <button
                onClick={handleReveal}
                disabled={selected === null}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  selected !== null
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Xem đáp án
              </button>
            )}

            {ratingMode === true && (
              <div className="flex space-x-3">
                <button
                  onClick={() => handleRate(DifficultyLevel.Easy)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Dễ
                </button>
                <button
                  onClick={() => handleRate(DifficultyLevel.Medium)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                >
                  Trung bình
                </button>
                <button
                  onClick={() => handleRate(DifficultyLevel.Hard)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Khó
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="font-medium text-gray-800">{stats.new}</div>
              <div className="text-gray-500">Câu mới</div>
            </div>
            <div>
              <div className="font-medium text-red-600">{stats.hard}</div>
              <div className="text-gray-500">Khó</div>
            </div>
            <div>
              <div className="font-medium text-yellow-600">{stats.medium}</div>
              <div className="text-gray-500">Trung bình</div>
            </div>
            <div>
              <div className="font-medium text-green-600">{stats.easy}</div>
              <div className="text-gray-500">Dễ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartReview;
