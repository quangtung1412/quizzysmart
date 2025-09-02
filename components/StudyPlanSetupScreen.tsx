import React, { useState } from 'react';
import { KnowledgeBase } from '../types';

interface StudyPlanSetupScreenProps {
  knowledgeBase: KnowledgeBase;
  onCreateStudyPlan: (totalDays: number, minutesPerDay: number) => void;
  onBack: () => void;
}

const StudyPlanSetupScreen: React.FC<StudyPlanSetupScreenProps> = ({
  knowledgeBase,
  onCreateStudyPlan,
  onBack
}) => {
  const [totalDays, setTotalDays] = useState<number>(30);
  const [minutesPerDay, setMinutesPerDay] = useState<number>(60);
  
  const totalQuestions = knowledgeBase.questions.length;
  const questionsPerDay = Math.ceil(totalQuestions / totalDays);
  const estimatedTimePerQuestion = Math.ceil(minutesPerDay / questionsPerDay);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDays < 1 || minutesPerDay < 10) {
      alert('Vui lòng nhập thời gian học tập hợp lý (ít nhất 1 ngày và 10 phút/ngày)');
      return;
    }
    onCreateStudyPlan(totalDays, minutesPerDay);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
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
          <h2 className="text-3xl font-bold text-slate-700">Thiết lập lộ trình ôn tập</h2>
          <p className="text-slate-600 mt-1">Tạo kế hoạch học tập cá nhân hóa cho bộ câu hỏi: <span className="font-semibold text-blue-600">{knowledgeBase.name}</span></p>
        </div>
      </div>

      {/* Knowledge Base Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 rounded-2xl border border-blue-200">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-blue-700">{knowledgeBase.name}</h3>
            <p className="text-blue-600">
              Tổng số câu hỏi: <span className="font-semibold">{totalQuestions}</span> câu
            </p>
          </div>
        </div>
      </div>

      {/* Setup Form */}
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Total Days */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Thời gian ôn tập (số ngày)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="365"
                value={totalDays}
                onChange={(e) => setTotalDays(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ví dụ: 30"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 text-sm">ngày</span>
              </div>
            </div>
            <p className="text-xs text-slate-600">Số ngày bạn muốn hoàn thành việc ôn tập</p>
          </div>

          {/* Minutes per Day */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Thời gian học mỗi ngày (phút)
            </label>
            <div className="relative">
              <input
                type="number"
                min="10"
                max="480"
                step="15"
                value={minutesPerDay}
                onChange={(e) => setMinutesPerDay(parseInt(e.target.value) || 10)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ví dụ: 60"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 text-sm">phút</span>
              </div>
            </div>
            <p className="text-xs text-slate-600">Thời gian bạn có thể dành cho việc ôn tập mỗi ngày</p>
          </div>
        </div>

        {/* Study Plan Preview */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h4 className="text-lg font-semibold text-slate-700 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l-1-3m1 3l1-3m-16.5-3h9v-.75a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0116.5 9V7.5a1.5 1.5 0 00-1.5-1.5H13A1.5 1.5 0 0011.5 7.5V9z" />
            </svg>
            Dự kiến lộ trình học tập
          </h4>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="text-2xl font-bold text-blue-600">{questionsPerDay}</div>
              <div className="text-sm text-slate-600">câu hỏi/ngày</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="text-2xl font-bold text-green-600">{estimatedTimePerQuestion}</div>
              <div className="text-sm text-slate-600">phút/câu hỏi</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="text-2xl font-bold text-purple-600">{Math.round((minutesPerDay / 60) * 10) / 10}</div>
              <div className="text-sm text-slate-600">giờ/ngày</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h5 className="font-semibold text-blue-800 mb-2">Cách thức hoạt động:</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Giai đoạn 1:</strong> Học tất cả {totalQuestions} câu hỏi trong {totalDays} ngày</li>
              <li>• Mỗi câu hỏi sẽ được đánh giá độ khó: <span className="font-medium">Dễ, Trung bình, Khó</span></li>
              <li>• Câu hỏi <span className="font-medium">"Khó"</span> sẽ xuất hiện lại thường xuyên hơn</li>
              <li>• <strong>Giai đoạn 2:</strong> Làm bài thi thử tổng hợp khi tất cả câu đều "Dễ"</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Tạo lộ trình học tập
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudyPlanSetupScreen;
