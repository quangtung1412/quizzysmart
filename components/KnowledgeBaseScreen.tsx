import React from 'react';
import { KnowledgeBase, StudyPlan } from '../types';

interface KnowledgeBaseScreenProps {
    bases: KnowledgeBase[];
    onSelect: (baseId: string) => void;
    onCreate?: () => void; // Made optional since regular users won't have this
    onViewHistory: () => void;
    onCreateStudyPlan: (knowledgeBase: KnowledgeBase) => void; // New prop
    studyPlans?: StudyPlan[]; // Optional study plans to check existing plans
    onViewStudyPlan?: (knowledgeBase: KnowledgeBase) => void; // View existing study plan
    isAdmin?: boolean; // Add flag to determine if user is admin
    onBack?: () => void; // Back to test list
}

const KnowledgeBaseScreen: React.FC<KnowledgeBaseScreenProps> = ({ bases, onSelect, onCreate, onViewHistory, onCreateStudyPlan, studyPlans = [], onViewStudyPlan, isAdmin = false, onBack }) => {

    return (
        <div className="w-full space-y-4 sm:space-y-6 p-4 sm:p-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Quay lại"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Cơ sở kiến thức</h2>
                        <p className="text-sm sm:text-base text-slate-600 mt-1">Chọn chủ đề để ôn tập</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                        onClick={onViewHistory}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-sky-700 bg-sky-100 border border-transparent rounded-lg shadow-sm hover:bg-sky-200 transition-colors min-h-[44px]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="sm:hidden">Lịch sử</span>
                        <span className="hidden sm:inline">Lịch sử ôn tập</span>
                    </button>
                    {isAdmin && onCreate && (
                        <button
                            onClick={onCreate}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-lg shadow-sm hover:bg-sky-700 transition-colors min-h-[44px]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="sm:hidden">Tạo mới</span>
                            <span className="hidden sm:inline">Tạo mới</span>
                        </button>
                    )}
                </div>
            </div>

            {bases.length === 0 ? (
                <div className="text-center py-12 sm:py-16 border-2 border-dashed border-slate-300 rounded-lg mx-4 sm:mx-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2">Chưa có cơ sở kiến thức nào</h3>
                    <p className="text-sm sm:text-base text-slate-500 px-4">
                        {isAdmin
                            ? 'Hãy tạo một cái mới để bắt đầu học.'
                            : 'Hiện tại chưa có cơ sở kiến thức nào. Vui lòng liên hệ admin để thêm nội dung.'
                        }
                    </p>
                    {isAdmin && onCreate && (
                        <div className="mt-6">
                            <button
                                onClick={onCreate}
                                className="px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 transition-colors min-h-[44px]"
                            >
                                Tạo cơ sở kiến thức đầu tiên
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {bases.map(base => (
                        <div
                            key={base.id}
                            className="group relative bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-sky-400 transition-all duration-300 flex flex-col justify-between"
                        >
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight line-clamp-2 mb-2">{base.name}</h3>
                                <p className="text-sm text-slate-500">{base.questions.length} câu hỏi</p>
                                <p className="text-xs text-slate-400 mt-2">
                                    Tạo ngày: {new Date(base.createdAt).toLocaleDateString('vi-VN')}
                                </p>
                            </div>
                            <div className="mt-4 sm:mt-6 flex flex-col space-y-2">
                                {onViewStudyPlan && (
                                    <button
                                        onClick={() => onViewStudyPlan(base)}
                                        className="w-full px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors min-h-[44px]"
                                    >
                                        🎯 Ôn tập chủ đề này
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KnowledgeBaseScreen;
