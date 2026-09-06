import React, { useState, useEffect } from 'react';
import FileUpload from '../FileUpload';
import { KnowledgeBase, Question } from '../../types';
import { api } from '../../src/api';

interface KnowledgeManagementProps {
  onSaveNewBase: (name: string, questions: Question[], topic?: string) => Promise<void>;
}

const KnowledgeManagement: React.FC<KnowledgeManagementProps> = ({ onSaveNewBase }) => {
  const [view, setView] = useState<'list' | 'upload'>('list');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [topicsList, setTopicsList] = useState<string[]>([]);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBaseIds, setSelectedBaseIds] = useState<string[]>([]);
  const [showBatchTopicModal, setShowBatchTopicModal] = useState(false);
  const [batchTopicMode, setBatchTopicMode] = useState<'existing' | 'new' | 'clear'>('existing');
  const [selectedBatchTopic, setSelectedBatchTopic] = useState('');
  const [newBatchTopicName, setNewBatchTopicName] = useState('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  useEffect(() => {
    loadKnowledgeBases();
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const res = await api.listTopics();
      if (Array.isArray(res)) {
        setTopicsList(res.map(t => t.name).filter(Boolean));
      }
    } catch (e) {
      console.warn('Failed to load topics:', e);
    }
  };

  const loadKnowledgeBases = async () => {
    try {
      setLoading(true);
      // Get all knowledge bases from all users (admin view)
      const response = await api.adminListKnowledgeBases();
      setKnowledgeBases(response);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allFilteredIds = filteredBases.map(b => b.id);
      setSelectedBaseIds(Array.from(new Set([...selectedBaseIds, ...allFilteredIds])));
    } else {
      const filteredIdSet = new Set(filteredBases.map(b => b.id));
      setSelectedBaseIds(selectedBaseIds.filter(id => !filteredIdSet.has(id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedBaseIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenBatchTopicModal = () => {
    if (selectedBaseIds.length === 0) return;
    setBatchTopicMode(topicsList.length > 0 ? 'existing' : 'new');
    setSelectedBatchTopic(topicsList[0] || '');
    setNewBatchTopicName('');
    setShowBatchTopicModal(true);
  };

  const handleApplyBatchTopic = async () => {
    if (selectedBaseIds.length === 0) return;
    let finalTopic: string | null = null;
    if (batchTopicMode === 'existing') {
      if (!selectedBatchTopic) {
        alert('Vui lòng chọn một chủ đề.');
        return;
      }
      finalTopic = selectedBatchTopic.trim();
    } else if (batchTopicMode === 'new') {
      if (!newBatchTopicName.trim()) {
        alert('Vui lòng nhập tên chủ đề mới.');
        return;
      }
      finalTopic = newBatchTopicName.trim();
    } else if (batchTopicMode === 'clear') {
      finalTopic = null;
    }

    try {
      setIsSubmittingBatch(true);
      await api.adminBatchAssignKnowledgeBaseTopic(selectedBaseIds, finalTopic);
      await loadKnowledgeBases();
      await loadTopics();
      setShowBatchTopicModal(false);
      setSelectedBaseIds([]);
    } catch (error: any) {
      console.error('Failed to batch assign topic:', error);
      alert(error.message || 'Không thể gán chủ đề. Vui lòng thử lại.');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleDeleteBase = async (baseId: string, baseName: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa bộ câu hỏi "${baseName}" không? Thao tác này cũng sẽ xóa tất cả dữ liệu liên quan.`)) {
      try {
        await api.adminDeleteKnowledgeBase(baseId);
        await loadKnowledgeBases(); // Reload list
      } catch (error) {
        console.error('Failed to delete knowledge base:', error);
        alert('Không thể xóa cơ sở kiến thức. Vui lòng thử lại.');
      }
    }
  };

  const handleSaveBase = async (name: string, questions: Question[], topic?: string) => {
    await onSaveNewBase(name, questions, topic);
    setView('list');
    await loadKnowledgeBases(); // Reload list
    await loadTopics();
  };

  const filteredBases = knowledgeBases.filter(base => {
    const matchesSearch =
      base.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (base.creatorEmail && base.creatorEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (base.topic && base.topic.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTopic =
      selectedTopicFilter === 'all'
        ? true
        : selectedTopicFilter === '__NONE__'
        ? !base.topic
        : base.topic === selectedTopicFilter;

    return matchesSearch && matchesTopic;
  });

  if (view === 'upload') {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại danh sách
          </button>
        </div>
        <FileUpload 
          onSaveNewBase={handleSaveBase} 
          onBack={() => setView('list')}
          availableTopics={topicsList} 
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý cơ sở kiến thức</h2>
          <p className="text-slate-600 mt-1">Quản lý tất cả cơ sở kiến thức trong hệ thống</p>
        </div>
        <button
          onClick={() => setView('upload')}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tạo cơ sở kiến thức mới
        </button>
      </div>

      {/* Search bar & Topic filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, chủ đề hoặc email người tạo..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="w-full md:w-64">
          <select
            value={selectedTopicFilter}
            onChange={(e) => setSelectedTopicFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm bg-white"
          >
            <option value="all">Tất cả chủ đề</option>
            {topicsList.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="__NONE__">Chưa phân loại chủ đề</option>
          </select>
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {selectedBaseIds.length > 0 && (
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-between">
          <div className="text-sm text-sky-800 font-medium">
            Đã chọn <span className="font-bold">{selectedBaseIds.length}</span> cơ sở kiến thức
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenBatchTopicModal}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              🏷️ Gán chủ đề hàng loạt
            </button>
            <button
              onClick={() => setSelectedBaseIds([])}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-2xl font-bold text-sky-600">{knowledgeBases.length}</div>
          <div className="text-sm text-slate-600">Tổng số cơ sở kiến thức</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-2xl font-bold text-green-600">
            {knowledgeBases.reduce((sum, base) => sum + base.questions.length, 0)}
          </div>
          <div className="text-sm text-slate-600">Tổng số câu hỏi</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-2xl font-bold text-purple-600">
            {new Set(knowledgeBases.map(base => base.creatorEmail)).size}
          </div>
          <div className="text-sm text-slate-600">Số người đóng góp</div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      ) : filteredBases.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900">
            {searchTerm || selectedTopicFilter !== 'all' ? 'Không tìm thấy kết quả' : 'Chưa có cơ sở kiến thức nào'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm || selectedTopicFilter !== 'all' ? 'Thử tìm kiếm hoặc chọn bộ lọc khác' : 'Tạo cơ sở kiến thức đầu tiên để bắt đầu'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                    checked={filteredBases.length > 0 && filteredBases.every(b => selectedBaseIds.includes(b.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tên cơ sở kiến thức
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Chủ đề
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Người tạo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Số câu hỏi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredBases.map((base) => (
                <tr key={base.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 whitespace-nowrap w-12">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                      checked={selectedBaseIds.includes(base.id)}
                      onChange={() => handleToggleSelectOne(base.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{base.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {base.topic ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {base.topic}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa phân loại</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600">{base.creatorEmail || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{base.questions.length}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-500">
                      {new Date(base.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteBase(base.id, base.name)}
                      className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                      title="Xóa cơ sở kiến thức"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Assign Topic Modal */}
      {showBatchTopicModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">🏷️ Gán chủ đề hàng loạt</h3>
            <p className="text-sm text-slate-600 mb-4">
              Đang chọn <span className="font-semibold text-sky-600">{selectedBaseIds.length}</span> cơ sở kiến thức để gán chủ đề.
            </p>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="batchTopicMode"
                    value="existing"
                    checked={batchTopicMode === 'existing'}
                    onChange={() => setBatchTopicMode('existing')}
                    className="text-sky-600"
                  />
                  Chọn chủ đề có sẵn
                </label>
                {batchTopicMode === 'existing' && (
                  <div className="mt-2 ml-6">
                    {topicsList.length > 0 ? (
                      <select
                        value={selectedBatchTopic}
                        onChange={(e) => setSelectedBatchTopic(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                      >
                        {topicsList.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-amber-600">Chưa có chủ đề nào trong hệ thống. Hãy chọn "Tạo chủ đề mới".</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="batchTopicMode"
                    value="new"
                    checked={batchTopicMode === 'new'}
                    onChange={() => setBatchTopicMode('new')}
                    className="text-sky-600"
                  />
                  Tạo chủ đề mới
                </label>
                {batchTopicMode === 'new' && (
                  <div className="mt-2 ml-6">
                    <input
                      type="text"
                      placeholder="Nhập tên chủ đề mới..."
                      value={newBatchTopicName}
                      onChange={(e) => setNewBatchTopicName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="batchTopicMode"
                    value="clear"
                    checked={batchTopicMode === 'clear'}
                    onChange={() => setBatchTopicMode('clear')}
                    className="text-red-600"
                  />
                  <span className="text-slate-700">Xóa chủ đề (đưa về Chưa phân loại)</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBatchTopicModal(false)}
                disabled={isSubmittingBatch}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleApplyBatchTopic}
                disabled={isSubmittingBatch}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSubmittingBatch ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Đang lưu...
                  </>
                ) : (
                  'Áp dụng'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeManagement;
