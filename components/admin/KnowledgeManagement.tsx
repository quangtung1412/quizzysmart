import React, { useState, useEffect } from 'react';
import FileUpload from '../FileUpload';
import { KnowledgeBase, Question } from '../../types';
import { api } from '../../src/api';

interface KnowledgeManagementProps {
  onSaveNewBase: (name: string, questions: Question[]) => Promise<void>;
}

const KnowledgeManagement: React.FC<KnowledgeManagementProps> = ({ onSaveNewBase }) => {
  const [view, setView] = useState<'list' | 'upload'>('list');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

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

  const handleSaveBase = async (name: string, questions: Question[]) => {
    await onSaveNewBase(name, questions);
    setView('list');
    await loadKnowledgeBases(); // Reload list
  };

  const filteredBases = knowledgeBases.filter(base =>
    base.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (base.creatorEmail && base.creatorEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email người tạo..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

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
            {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có cơ sở kiến thức nào'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm ? 'Thử tìm kiếm với từ khóa khác' : 'Tạo cơ sở kiến thức đầu tiên để bắt đầu'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tên cơ sở kiến thức
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{base.name}</div>
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
    </div>
  );
};

export default KnowledgeManagement;
