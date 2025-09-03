import React from 'react';
import { StudyPlan, KnowledgeBase } from '../types';

interface StudyPlanListScreenProps {
    knowledgeBase: KnowledgeBase;
    studyPlans: StudyPlan[];
    onCreateNew: () => void;
    onSelectPlan: (plan: StudyPlan) => void;
    onEditPlan: (plan: StudyPlan) => void;
    onDeletePlan: (planId: string) => void;
    onBack: () => void;
}

const StudyPlanListScreen: React.FC<StudyPlanListScreenProps> = ({ knowledgeBase, studyPlans, onCreateNew, onSelectPlan, onEditPlan, onDeletePlan, onBack }) => {
    const plansForKB = studyPlans.filter(p => p.knowledgeBaseId === knowledgeBase.id);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Quay lại">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-700">Lộ trình ôn tập</h2>
                        <p className="text-slate-500 text-sm">{knowledgeBase.name}</p>
                    </div>
                </div>
                <button onClick={onCreateNew} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
                    + Tạo lộ trình mới
                </button>
            </div>

            {plansForKB.length === 0 && (
                <div className="p-10 border-2 border-dashed border-slate-300 rounded-xl text-center">
                    <p className="text-slate-600 mb-4">Chưa có lộ trình nào cho bộ này.</p>
                    <button onClick={onCreateNew} className="px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">Tạo lộ trình đầu tiên</button>
                </div>
            )}

            {plansForKB.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plansForKB.map(plan => {
                        const progress = plan.questionProgress.length === 0 ? 0 : Math.round((plan.completedQuestions.length / plan.questionProgress.length) * 100);
                        return (
                            <div key={plan.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-slate-800 truncate">
                                        {plan.title || `Lộ trình ${knowledgeBase.name}`}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-200">{progress}%</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditPlan(plan);
                                            }}
                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                            title="Chỉnh sửa lộ trình"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Bạn có chắc muốn xóa lộ trình này không?')) {
                                                    onDeletePlan(plan.id);
                                                }
                                            }}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            title="Xóa lộ trình"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div
                                    className="cursor-pointer flex-1"
                                    onClick={() => onSelectPlan(plan)}
                                >
                                    <div className="text-sm text-slate-600 mb-2">
                                        Ngày {plan.currentDay}/{plan.totalDays} • {plan.questionsPerDay} câu/ngày • {plan.minutesPerDay} phút/ngày
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                                        <div
                                            className="h-full bg-gradient-to-r from-sky-500 to-green-500 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center justify-between">
                                        <span>Bắt đầu: {new Date(plan.startDate).toLocaleDateString('vi-VN')}</span>
                                        <span>Kết thúc: {new Date(plan.endDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StudyPlanListScreen;
