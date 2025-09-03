import React, { useState } from 'react';
import { StudyPlan, StudyPhase, DifficultyLevel } from '../types';
import { api } from '../src/api';

interface StudyPlanOverviewScreenProps {
  studyPlan: StudyPlan;
  onStartDailyStudy: () => void;
  onStartSmartReview: () => void;
  onStartPhase2: () => void;
  onDeleteStudyPlan: () => void;
  onUpdateStudyPlan: (updatedPlan: StudyPlan) => void;
  onBack: () => void;
}

const StudyPlanOverviewScreen: React.FC<StudyPlanOverviewScreenProps> = ({
  studyPlan,
  onStartDailyStudy,
  onStartSmartReview,
  onStartPhase2,
  onDeleteStudyPlan,
  onUpdateStudyPlan,
  onBack
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [editForm, setEditForm] = useState({
    title: studyPlan.title || '',
    totalDays: studyPlan.totalDays,
    minutesPerDay: studyPlan.minutesPerDay
  });

  const totalQuestions = studyPlan.questionProgress.length;
  const completedQuestions = studyPlan.completedQuestions.length;
  const easyQuestions = studyPlan.questionProgress.filter(q => q.difficultyLevel === DifficultyLevel.Easy).length;
  const mediumQuestions = studyPlan.questionProgress.filter(q => q.difficultyLevel === DifficultyLevel.Medium).length;
  const hardQuestions = studyPlan.questionProgress.filter(q => q.difficultyLevel === DifficultyLevel.Hard).length;
  const unratedQuestions = totalQuestions - easyQuestions - mediumQuestions - hardQuestions;

  const overallProgress = (completedQuestions / totalQuestions) * 100;
  const isPhase2Ready = studyPlan.currentPhase === StudyPhase.Review || completedQuestions === totalQuestions;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getDaysRemaining = () => {
    const endDate = new Date(studyPlan.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleResetProgress = async () => {
    setIsResetting(true);
    try {
      await api.resetStudyPlanProgress(studyPlan.id);

      // Reset the study plan progress
      const resetStudyPlan = {
        ...studyPlan,
        questionProgress: [],
        completedQuestions: [],
        currentPhase: StudyPhase.Initial
      };
      onUpdateStudyPlan(resetStudyPlan);
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Failed to reset progress', error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteConfirm = () => {
    onDeleteStudyPlan();
    setShowDeleteConfirm(false);
  };

  const handleSaveEdit = () => {
    const updatedPlan = {
      ...studyPlan,
      title: editForm.title || `Lộ trình ${studyPlan.knowledgeBaseName}`,
      totalDays: editForm.totalDays,
      minutesPerDay: editForm.minutesPerDay,
      questionsPerDay: Math.ceil(studyPlan.questionProgress.length / editForm.totalDays)
    };

    onUpdateStudyPlan(updatedPlan);
    setShowEditModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Quay lại"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-slate-700">Lộ trình ôn tập</h2>
            <p className="text-slate-600">{studyPlan.title || studyPlan.knowledgeBaseName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Chỉnh sửa lộ trình"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            title="Reset tiến trình học"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa lộ trình học tập"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Phase Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 rounded-2xl border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${isPhase2Ready ? 'bg-green-500' : 'bg-blue-500'
              }`}>
              {isPhase2Ready ? '2' : '1'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-blue-800">
                {isPhase2Ready ? 'Giai đoạn 2: Thi thử tổng hợp' : 'Giai đoạn 1: Học tất cả câu hỏi'}
              </h3>
              <p className="text-blue-600">
                {isPhase2Ready
                  ? 'Tất cả câu hỏi đã được đánh giá "Dễ". Sẵn sàng làm bài thi thử!'
                  : `Học ${totalQuestions} câu hỏi trong ${studyPlan.totalDays} ngày`
                }
              </p>
            </div>
          </div>

          {isPhase2Ready && (
            <button
              onClick={onStartPhase2}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
            >
              Bắt đầu thi thử
            </button>
          )}
        </div>
      </div>

      {/* Study Guidelines */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Cách thức học tập thông minh
        </h4>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-green-700">
          <div className="space-y-2">
            <h5 className="font-semibold">📚 Hệ thống thông minh:</h5>
            <ul className="list-disc list-inside space-y-1">
              <li>Câu cũ xuất hiện sau 5-10 câu mới</li>
              <li>Đánh dấu "đã học" cho câu cũ</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h5 className="font-semibold">⚡ Học hiệu quả:</h5>
            <ul className="list-disc list-inside space-y-1">
              <li>Đánh giá thành thật độ khó</li>
              <li>Ôn lại thường xuyên</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h5 className="font-semibold">🎯 Tiến bộ:</h5>
            <ul className="list-disc list-inside space-y-1">
              <li>Có thể học vượt mỗi ngày</li>
              <li>Theo dõi tiến độ real-time</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Overall Progress */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
          <h4 className="text-lg font-semibold text-slate-700 mb-4">Tiến độ tổng thể</h4>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>Hoàn thành</span>
              <span>{completedQuestions}/{totalQuestions} câu ({Math.round(overallProgress)}%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{studyPlan.currentDay}</div>
              <div className="text-sm text-slate-600">Ngày hiện tại</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{getDaysRemaining()}</div>
              <div className="text-sm text-slate-600">Ngày còn lại</div>
            </div>
          </div>
        </div>

        {/* Question Statistics */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
          <h4 className="text-lg font-semibold text-slate-700 mb-4">Thống kê câu hỏi</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Dễ</span>
              </div>
              <span className="font-bold text-green-600">{easyQuestions}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <span className="font-medium text-yellow-800">Trung bình</span>
              </div>
              <span className="font-bold text-yellow-600">{mediumQuestions}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="font-medium text-red-800">Khó</span>
              </div>
              <span className="font-bold text-red-600">{hardQuestions}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-slate-400 rounded-full"></div>
                <span className="font-medium text-slate-700">Chưa học</span>
              </div>
              <span className="font-bold text-slate-600">{unratedQuestions}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Study Schedule Info */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
        <h4 className="text-lg font-semibold text-slate-700 mb-4">Thông tin lộ trình</h4>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">{studyPlan.questionsPerDay}</div>
            <div className="text-sm text-slate-600">Câu/ngày</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <div className="text-2xl font-bold text-purple-600">{studyPlan.minutesPerDay}</div>
            <div className="text-sm text-slate-600">Phút/ngày</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <div className="text-2xl font-bold text-green-600">{formatDate(studyPlan.startDate)}</div>
            <div className="text-sm text-slate-600">Ngày bắt đầu</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="text-2xl font-bold text-red-600">{formatDate(studyPlan.endDate)}</div>
            <div className="text-sm text-slate-600">Ngày kết thúc</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isPhase2Ready && (
        <div className="text-center space-y-4">
          <button
            onClick={onStartDailyStudy}
            className="block w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            📚 Bắt đầu học hôm nay
          </button>
          <button
            onClick={onStartSmartReview}
            className="block w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-2xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            🧠 Ôn tập thông minh
          </button>
          <p className="text-slate-600 text-sm">
            Tiếp tục hành trình ôn luyện của bạn với hệ thống spaced repetition
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Xác nhận xóa lộ trình</h3>
            <p className="text-slate-600 mb-6">
              Bạn có chắc chắn muốn xóa lộ trình học tập này không?
              Tất cả tiến độ học tập sẽ bị mất và không thể khôi phục.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Study Plan Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md mx-4 w-full">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Chỉnh sửa lộ trình</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên lộ trình</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên lộ trình"
                />
              </div>
              <div>
                <label htmlFor="totalDays" className="block text-sm font-medium text-slate-700 mb-1">Tổng số ngày</label>
                <input
                  id="totalDays"
                  type="number"
                  value={editForm.totalDays}
                  onChange={(e) => setEditForm(prev => ({ ...prev, totalDays: parseInt(e.target.value) || 1 }))}
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Số ngày trong lộ trình học"
                />
              </div>
              <div>
                <label htmlFor="minutesPerDay" className="block text-sm font-medium text-slate-700 mb-1">Thời gian học mỗi ngày (phút)</label>
                <input
                  id="minutesPerDay"
                  type="number"
                  value={editForm.minutesPerDay}
                  onChange={(e) => setEditForm(prev => ({ ...prev, minutesPerDay: parseInt(e.target.value) || 15 }))}
                  min="5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Thời gian học mỗi ngày"
                />
              </div>
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Progress Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Reset tiến trình học?</h3>
            <p className="text-slate-600 mb-6">
              Hành động này sẽ xóa toàn bộ tiến trình học của bạn cho lộ trình này.
              Bạn sẽ phải bắt đầu lại từ đầu. Bạn có chắc chắn muốn tiếp tục?
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleResetProgress}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Đang reset...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPlanOverviewScreen;
