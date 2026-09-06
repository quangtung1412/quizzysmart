import React, { useState, useMemo } from 'react';
import { KnowledgeBase, StudyPlan } from '../types';

interface KnowledgeBaseScreenProps {
  bases: KnowledgeBase[];
  onSelect: (baseId: string) => void;
  onCreate?: () => void;
  onViewHistory: () => void;
  onCreateStudyPlan: (knowledgeBase: KnowledgeBase) => void;
  studyPlans?: StudyPlan[];
  onViewStudyPlan?: (knowledgeBase: KnowledgeBase) => void;
  isAdmin?: boolean;
  onBack?: () => void;
}

const KnowledgeBaseScreen: React.FC<KnowledgeBaseScreenProps> = ({
  bases,
  onSelect,
  onCreate,
  onViewHistory,
  onCreateStudyPlan,
  studyPlans = [],
  onViewStudyPlan,
  isAdmin = false,
  onBack
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'by_topic' | 'all'>('by_topic');
  const [searchQuery, setSearchQuery] = useState('');

  // Nhóm các cơ sở kiến thức theo Chủ đề
  const topicGroups = useMemo(() => {
    const groups: {
      [key: string]: {
        key: string;
        name: string;
        bases: KnowledgeBase[];
        totalQuestions: number;
      };
    } = {};

    bases.forEach(base => {
      const rawTopic = (base.topic && base.topic.trim()) ? base.topic.trim() : '__OTHER__';
      if (!groups[rawTopic]) {
        groups[rawTopic] = {
          key: rawTopic,
          name: rawTopic === '__OTHER__' ? 'Chủ đề khác' : rawTopic,
          bases: [],
          totalQuestions: 0
        };
      }
      groups[rawTopic].bases.push(base);
      groups[rawTopic].totalQuestions += (base.questions ? base.questions.length : 0);
    });

    return groups;
  }, [bases]);

  // Kiểm tra có ít nhất 1 cơ sở kiến thức được gán chủ đề
  const hasTopics = useMemo(() => {
    return Object.keys(topicGroups).some(k => k !== '__OTHER__');
  }, [topicGroups]);

  // Lọc theo tìm kiếm
  const filteredBases = useMemo(() => {
    if (!searchQuery.trim()) return bases;
    const q = searchQuery.toLowerCase();
    return bases.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.topic && b.topic.toLowerCase().includes(q))
    );
  }, [bases, searchQuery]);

  // Render thẻ hiển thị 1 cơ sở kiến thức con
  const renderBaseCard = (base: KnowledgeBase) => {
    return (
      <div
        key={base.id}
        className="group relative bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-sky-400 transition-all duration-200 flex flex-col justify-between"
      >
        <div>
          {base.topic && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                🏷️ {base.topic}
              </span>
            </div>
          )}
          <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-sky-600 transition-colors">
            {base.name}
          </h3>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {base.questions?.length || 0} câu hỏi
            </span>
            <span>•</span>
            <span className="text-xs text-slate-400">
              {new Date(base.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onSelect(base.id)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors min-h-[42px] flex items-center justify-center gap-1.5"
          >
            🎯 Ôn tập bài này
          </button>
          {onViewStudyPlan && (
            <button
              onClick={() => onViewStudyPlan(base)}
              className="px-3.5 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors min-h-[42px] flex items-center justify-center gap-1"
              title="Kế hoạch ôn tập"
            >
              📅 Kế hoạch
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 p-4 sm:p-0">
      {/* Header với navigation và actions */}
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
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Ôn luyện kiến thức</h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Chọn chủ đề và bài học để bắt đầu ôn tập</p>
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
              <span>Tạo mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Thanh tìm kiếm và bộ chuyển đổi chế độ xem */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm bài ôn tập, chủ đề..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-600 focus:ring-1 focus:ring-sky-600 focus:border-sky-600 text-sm sm:text-base"
          />
        </div>

        {/* View Mode Toggle (khi không tìm kiếm và có chủ đề) */}
        {!searchQuery && hasTopics && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('by_topic')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                viewMode === 'by_topic'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📁 Theo chủ đề
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('all');
                setSelectedTopic(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                viewMode === 'all'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 Tất cả bài ôn ({bases.length})
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {/* 1. Khi đang tìm kiếm */}
      {searchQuery.trim() !== '' ? (
        filteredBases.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">
              Không tìm thấy bài ôn tập nào
            </h3>
            <p className="text-sm sm:text-base text-slate-500">
              Không có bài ôn tập nào khớp với "{searchQuery}"
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-sky-600 hover:text-sky-800 font-medium text-sm min-h-[44px] px-4 py-2"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Tìm thấy <span className="font-semibold text-sky-600">{filteredBases.length}</span> bài ôn tập phù hợp:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredBases.map(renderBaseCard)}
            </div>
          </div>
        )
      ) : bases.length === 0 ? (
        /* 2. Chưa có cơ sở kiến thức nào */
        <div className="text-center py-12 sm:py-16 border-2 border-dashed border-slate-300 rounded-lg mx-4 sm:mx-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-base sm:text-lg font-medium text-slate-800 mb-2">Chưa có cơ sở kiến thức nào</h3>
          <p className="text-sm sm:text-base text-slate-500 px-4">
            {isAdmin
              ? 'Hãy tạo một cơ sở kiến thức mới để bắt đầu học.'
              : 'Hiện tại chưa có cơ sở kiến thức nào. Vui lòng liên hệ quản trị viên để thêm nội dung.'}
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
      ) : viewMode === 'by_topic' && hasTopics ? (
        /* 3. Chế độ theo chủ đề */
        selectedTopic === null ? (
          /* CẤP 1: CHỌN CHỦ ĐỀ */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>📚</span> Chọn chủ đề ôn tập
              </h3>
              <span className="text-xs sm:text-sm text-slate-500">
                {Object.keys(topicGroups).length} chủ đề
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Object.values(topicGroups).map(group => (
                <div
                  key={group.key}
                  onClick={() => setSelectedTopic(group.key)}
                  className="bg-white border border-slate-200 hover:border-sky-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                        📁
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        {group.totalQuestions} câu hỏi
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-base sm:text-lg mb-1 group-hover:text-sky-600 transition-colors">
                      {group.name}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-500 mb-4">
                      Gồm <span className="font-semibold text-slate-700">{group.bases.length}</span> bài ôn tập con
                    </p>
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-sky-600 group-hover:text-sky-700">
                    <span>Vào xem bài ôn tập</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CẤP 2: DANH SÁCH BÀI ÔN TẬP CON TRONG CHỦ ĐỀ */
          <div className="space-y-5">
            {/* Breadcrumb & Nút quay lại */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="font-medium text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Tất cả chủ đề
                </button>
                <span>/</span>
                <span className="font-bold text-slate-800">
                  {topicGroups[selectedTopic]?.name || selectedTopic}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-slate-500">
                {topicGroups[selectedTopic]?.bases.length || 0} bài ôn tập con
              </div>
            </div>

            {/* Danh sách bài con */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {(topicGroups[selectedTopic]?.bases || []).map(renderBaseCard)}
            </div>
          </div>
        )
      ) : (
        /* 4. Chế độ xem tất cả (danh sách phẳng) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredBases.map(renderBaseCard)}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseScreen;
