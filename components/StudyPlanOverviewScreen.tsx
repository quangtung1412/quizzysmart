import React, { useState } from 'react';
import { StudyPlan, StudyPhase, DifficultyLevel } from '../types';

interface StudyPlanOverviewScreenProps {
  studyPlan: StudyPlan;
  onStartDailyStudy: () => void;
  onStartPhase2: () => void;
  onDeleteStudyPlan: () => void;
  onBack: () => void;
}

const StudyPlanOverviewScreen: React.FC<StudyPlanOverviewScreenProps> = ({
  studyPlan,
  onStartDailyStudy,
  onStartPhase2,
  onDeleteStudyPlan,
  onBack
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDeleteConfirm = () => {
    onDeleteStudyPlan();
    setShowDeleteConfirm(false);
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
            <p className="text-slate-600">{studyPlan.knowledgeBaseName}</p>
          </div>
        </div>

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

      {/* Phase Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 rounded-2xl border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
              isPhase2Ready ? 'bg-green-500' : 'bg-blue-500'
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
                style={{ width: `${overallProgress}%` }}
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

      {/* Action Button */}
      {!isPhase2Ready && (
        <div className="text-center">
          <button
            onClick={onStartDailyStudy}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            📚 Bắt đầu học hôm nay
          </button>
          <p className="text-slate-600 mt-2 text-sm">
            Tiếp tục hành trình ôn luyện của bạn
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
    </div>
  );
};

export default StudyPlanOverviewScreen;
