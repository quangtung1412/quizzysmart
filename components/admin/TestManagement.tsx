import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../src/api';
import TestDetail from './TestDetail';

// Utility function to generate random background colors for capsules
const getRandomColor = () => {
  const colors = [
    'bg-red-100 text-red-800',
    'bg-blue-100 text-blue-800', 
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-gray-100 text-gray-800',
    'bg-orange-100 text-orange-800',
    'bg-teal-100 text-teal-800'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Capsule component for users and groups
const Capsule: React.FC<{ 
  text: string; 
  onRemove: () => void; 
  color?: string;
  isGroup?: boolean;
}> = ({ text, onRemove, color, isGroup = false }) => {
  // Generate random color only once when component mounts
  const randomColor = useMemo(() => getRandomColor(), []);
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium relative ${color || randomColor}`}>
      {isGroup && (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      )}
      <span>{text}</span>
      <button 
        onClick={onRemove}
        className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors"
        type="button"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

interface Test {
  id: string;
  name: string;
  description?: string;
  questionCount: number;
  timeLimit: number;
  maxAttempts: number;
  startTime?: string;
  endTime?: string;
  isActive: boolean;
  createdAt: string;
  knowledgeSources: KnowledgeSource[];
  assignedUsers: AssignedUser[];
}

interface KnowledgeSource {
  knowledgeBaseId: string;
  percentage: number;
}

interface AssignedUser {
  id: string;
  name: string;
  email: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  questions: any[];
  creatorEmail?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const TestManagement: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [adminGroupAssigned, setAdminGroupAssigned] = useState(true); // Default admin group assigned
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    questionCount: 20,
    timeLimit: 60, // minutes
    maxAttempts: 0, // default unlimited attempts
    startTime: '',
    endTime: '',
    knowledgeSources: [{ knowledgeBaseId: '', percentage: 100 }] as KnowledgeSource[],
    assignedUsers: [] as string[]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [testsData, basesData, usersData] = await Promise.all([
        api.adminListTests(),
        api.adminListKnowledgeBases(),
        api.adminListUsers()
      ]);
      setTests(testsData);
      setKnowledgeBases(basesData);
      setUsers(usersData); // Include all users including admin
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      questionCount: 20,
      timeLimit: 60,
      maxAttempts: 0,
      startTime: '',
      endTime: '',
      knowledgeSources: [{ knowledgeBaseId: '', percentage: 100 }],
      assignedUsers: users.map(u => u.id) // Default select all users including admin
    });
    setAdminGroupAssigned(true); // Default admin group assigned
  };

  const addKnowledgeSource = () => {
    const remainingPercentage = 100 - formData.knowledgeSources.reduce((sum, ks) => sum + ks.percentage, 0);
    setFormData(prev => ({
      ...prev,
      knowledgeSources: [...prev.knowledgeSources, { knowledgeBaseId: '', percentage: Math.max(0, remainingPercentage) }]
    }));
  };

  const updateKnowledgeSource = (index: number, field: keyof KnowledgeSource, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      knowledgeSources: prev.knowledgeSources.map((ks, i) => 
        i === index ? { ...ks, [field]: value } : ks
      )
    }));
  };

  const removeKnowledgeSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      knowledgeSources: prev.knowledgeSources.filter((_, i) => i !== index)
    }));
  };

  const toggleUserAssignment = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedUsers: prev.assignedUsers.includes(userId)
        ? prev.assignedUsers.filter(id => id !== userId)
        : [...prev.assignedUsers, userId]
    }));
  };

  const selectAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      assignedUsers: filteredUsers.map(u => u.id)
    }));
  };

  const unselectAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      assignedUsers: []
    }));
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const getTotalPercentage = () => {
    return formData.knowledgeSources.reduce((sum, ks) => sum + (ks.percentage || 0), 0);
  };

  const canSubmit = () => {
    return (
      formData.name.trim() &&
      formData.questionCount > 0 &&
      formData.timeLimit > 0 &&
      formData.knowledgeSources.length > 0 &&
      formData.knowledgeSources.every(ks => ks.knowledgeBaseId && ks.percentage > 0) &&
      Math.abs(getTotalPercentage() - 100) < 0.01 &&
      formData.assignedUsers.length > 0
    );
  };

  const handleCreateTest = async () => {
    if (!canSubmit()) return;
    
    setLoading(true);
    try {
      await api.adminCreateTest({
        name: formData.name,
        description: formData.description,
        questionCount: formData.questionCount,
        timeLimit: formData.timeLimit,
        maxAttempts: formData.maxAttempts,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        knowledgeSources: formData.knowledgeSources,
        assignedUsers: formData.assignedUsers
      });
      
      setShowCreateModal(false);
      resetForm();
      await loadData();
      alert('Tạo bài thi thành công!');
    } catch (error) {
      console.error('Failed to create test:', error);
      alert('Có lỗi xảy ra khi tạo bài thi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTest = (test: Test) => {
    setFormData({
      name: test.name,
      description: test.description || '',
      questionCount: test.questionCount,
      timeLimit: test.timeLimit,
      maxAttempts: test.maxAttempts, // Use exact value from database
      startTime: test.startTime ? new Date(test.startTime).toISOString().slice(0, 16) : '',
      endTime: test.endTime ? new Date(test.endTime).toISOString().slice(0, 16) : '',
      knowledgeSources: test.knowledgeSources,
      assignedUsers: test.assignedUsers.map(u => u.id)
    });
    // Check if admin group was assigned (we'll assume it was assigned if any admin is in the list)
    const hasAdminInAssignment = test.assignedUsers.some(u => users.find(user => user.id === u.id && user.role === 'admin'));
    setAdminGroupAssigned(hasAdminInAssignment);
    setSelectedTestId(test.id);
    setShowEditModal(true);
  };

  const handleUpdateTest = async () => {
    if (!canSubmit() || !selectedTestId) return;
    
    setLoading(true);
    try {
      // This would need a new API endpoint for updating tests
      await api.adminUpdateTest(selectedTestId, {
        name: formData.name,
        description: formData.description,
        questionCount: formData.questionCount,
        timeLimit: formData.timeLimit,
        maxAttempts: formData.maxAttempts,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        knowledgeSources: formData.knowledgeSources,
        assignedUsers: formData.assignedUsers
      });
      
      setShowEditModal(false);
      setSelectedTestId(null);
      resetForm();
      await loadData();
      alert('Cập nhật bài thi thành công!');
    } catch (error) {
      console.error('Failed to update test:', error);
      alert('Có lỗi xảy ra khi cập nhật bài thi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (testId: string, testName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài thi "${testName}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await api.adminDeleteTest(testId);
      await loadData();
      alert('Xóa bài thi thành công!');
    } catch (error) {
      console.error('Failed to delete test:', error);
      alert('Có lỗi xảy ra khi xóa bài thi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = (testId: string) => {
    setSelectedTestId(testId);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-slate-800">Quản lý bài thi</h3>
        <button 
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
        >
          Tạo bài thi mới
        </button>
      </div>

      {/* Test Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-blue-500">
          <h4 className="font-semibold text-slate-600">Tổng bài thi</h4>
          <p className="text-2xl font-bold text-blue-600">{tests.length}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-green-500">
          <h4 className="font-semibold text-slate-600">Đang hoạt động</h4>
          <p className="text-2xl font-bold text-green-600">{tests.filter(t => t.isActive).length}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-yellow-500">
          <h4 className="font-semibold text-slate-600">Cơ sở kiến thức</h4>
          <p className="text-2xl font-bold text-yellow-600">{knowledgeBases.length}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-purple-500">
          <h4 className="font-semibold text-slate-600">Người dùng</h4>
          <p className="text-2xl font-bold text-purple-600">{users.length}</p>
        </div>
      </div>

      {/* Tests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-800">Danh sách bài thi</h4>
        </div>
        <div className="overflow-x-auto">
          {loading && !showCreateModal ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600"></div>
              <p className="mt-2 text-slate-500">Đang tải...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-600">Tên bài thi</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Số câu hỏi</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Thời gian</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Số lần thi</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Thời gian thi</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Được gán</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Trạng thái</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tests.map(test => (
                  <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{test.name}</div>
                      {test.description && (
                        <div className="text-sm text-slate-500">{test.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{test.questionCount} câu</td>
                    <td className="px-6 py-4 text-slate-600">{test.timeLimit} phút</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                        {test.maxAttempts === 0 ? 'Vô hạn' : `${test.maxAttempts} lần`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="text-xs">
                        {test.startTime && (
                          <div>Bắt đầu: {new Date(test.startTime).toLocaleString('vi-VN')}</div>
                        )}
                        {test.endTime && (
                          <div>Kết thúc: {new Date(test.endTime).toLocaleString('vi-VN')}</div>
                        )}
                        {!test.startTime && !test.endTime && (
                          <div className="text-slate-400">Không giới hạn</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {test.assignedUsers.length} người dùng
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        test.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {test.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleEditTest(test)}
                          className="text-sky-600 hover:text-sky-900 font-medium transition-colors"
                        >
                          Sửa
                        </button>
                        <button 
                          onClick={() => handleViewResults(test.id)}
                          className="text-emerald-600 hover:text-emerald-900 font-medium transition-colors"
                        >
                          Xem kết quả
                        </button>
                        <button 
                          onClick={() => handleDeleteTest(test.id, test.name)}
                          className="text-red-600 hover:text-red-900 font-medium transition-colors"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-semibold">Tạo bài thi mới</h4>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-800 border-b pb-2">Thông tin cơ bản</h5>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên bài thi *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nhập tên bài thi..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nhập mô tả bài thi..."
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số câu hỏi *</label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={formData.questionCount}
                      onChange={e => setFormData(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút) *</label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={formData.timeLimit}
                      onChange={e => setFormData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Số lần thi tối đa *
                      <span className="text-xs text-slate-500 ml-1">(0 = Vô hạn)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.maxAttempts}
                      onChange={e => setFormData(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="0 = Vô hạn"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian bắt đầu</label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian kết thúc</label>
                    <input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Knowledge Sources & Users */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-800 border-b pb-2">Cấu hình nâng cao</h5>
                
                {/* Knowledge Sources */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Cơ sở kiến thức * 
                      <span className={`ml-2 text-xs ${getTotalPercentage() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                        (Tổng: {getTotalPercentage()}%)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={addKnowledgeSource}
                      className="text-sm text-sky-600 hover:text-sky-800"
                    >
                      + Thêm
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formData.knowledgeSources.map((source, index) => (
                      <div key={index} className="flex gap-2 items-center p-2 bg-slate-50 rounded">
                        <select
                          value={source.knowledgeBaseId}
                          onChange={e => updateKnowledgeSource(index, 'knowledgeBaseId', e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          <option value="">-- Chọn cơ sở kiến thức --</option>
                          {knowledgeBases.map(kb => (
                            <option key={kb.id} value={kb.id}>
                              {kb.name} ({kb.questions.length} câu)
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={source.percentage}
                          onChange={e => updateKnowledgeSource(index, 'percentage', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="%"
                        />
                        {formData.knowledgeSources.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeKnowledgeSource(index)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* User Assignment */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Gán cho người dùng * ({formData.assignedUsers.length + (adminGroupAssigned ? 1 : 0)} đã chọn)
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllUsers}
                        className="text-xs text-sky-600 hover:text-sky-800"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={unselectAllUsers}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                  </div>

                  {/* Selected Users/Groups Display */}
                  <div className="mb-3 min-h-[2rem] p-2 border border-slate-200 rounded-md bg-slate-50">
                    <div className="flex flex-wrap gap-2">
                      {/* Admin Group Capsule */}
                      {adminGroupAssigned && (
                        <Capsule 
                          text="Admin Group" 
                          onRemove={() => setAdminGroupAssigned(false)}
                          color="bg-blue-100 text-blue-800"
                          isGroup={true}
                        />
                      )}
                      
                      {/* Individual User Capsules */}
                      {formData.assignedUsers.map(userId => {
                        const user = users.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <Capsule 
                            key={userId}
                            text={user.name || user.email}
                            onRemove={() => toggleUserAssignment(userId)}
                          />
                        );
                      })}
                      
                      {!adminGroupAssigned && formData.assignedUsers.length === 0 && (
                        <span className="text-slate-400 text-sm">Chưa có ai được gán</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Search Users */}
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Tìm kiếm người dùng..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  
                  {/* Add Admin Group Option */}
                  <div className="mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                      <input
                        type="checkbox"
                        checked={adminGroupAssigned}
                        onChange={() => setAdminGroupAssigned(!adminGroupAssigned)}
                      />
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-blue-700">Admin Group</div>
                          <div className="text-xs text-slate-500">Tất cả admin có thể truy cập bài thi này</div>
                        </div>
                      </div>
                    </label>
                  </div>
                  
                  <div className="border border-slate-300 rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center text-slate-500 py-4">
                        Không tìm thấy người dùng nào
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <label key={user.id} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                          <input
                            type="checkbox"
                            checked={formData.assignedUsers.includes(user.id)}
                            onChange={() => toggleUserAssignment(user.id)}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{user.name || user.email}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                            {user.role === 'admin' && (
                              <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">Admin</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Hủy
              </button>
              <button 
                onClick={handleCreateTest}
                disabled={!canSubmit() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang tạo...' : 'Tạo bài thi'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Test Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-semibold">Sửa bài thi</h4>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTestId(null);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-800 border-b pb-2">Thông tin cơ bản</h5>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên bài thi *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nhập tên bài thi..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nhập mô tả bài thi..."
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số câu hỏi *</label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={formData.questionCount}
                      onChange={e => setFormData(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút) *</label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={formData.timeLimit}
                      onChange={e => setFormData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Số lần thi tối đa *</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.maxAttempts}
                      onChange={e => setFormData(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian bắt đầu</label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian kết thúc</label>
                    <input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Knowledge Sources & Users */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-800 border-b pb-2">Cấu hình nâng cao</h5>
                
                {/* Knowledge Sources */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Cơ sở kiến thức * 
                      <span className={`ml-2 text-xs ${getTotalPercentage() === 100 ? 'text-green-600' : 'text-red-600'}`}>
                        (Tổng: {getTotalPercentage()}%)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={addKnowledgeSource}
                      className="text-sm text-sky-600 hover:text-sky-800"
                    >
                      + Thêm
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formData.knowledgeSources.map((source, index) => (
                      <div key={index} className="flex gap-2 items-center p-2 bg-slate-50 rounded">
                        <select
                          value={source.knowledgeBaseId}
                          onChange={e => updateKnowledgeSource(index, 'knowledgeBaseId', e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          <option value="">-- Chọn cơ sở kiến thức --</option>
                          {knowledgeBases.map(kb => (
                            <option key={kb.id} value={kb.id}>
                              {kb.name} ({kb.questions.length} câu)
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={source.percentage}
                          onChange={e => updateKnowledgeSource(index, 'percentage', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="%"
                        />
                        {formData.knowledgeSources.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeKnowledgeSource(index)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* User Assignment - Same as create modal */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Gán cho người dùng * ({formData.assignedUsers.length + (adminGroupAssigned ? 1 : 0)} đã chọn)
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={selectAllUsers}
                        className="text-xs text-sky-600 hover:text-sky-800"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={unselectAllUsers}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                  </div>

                  {/* Selected Users/Groups Display */}
                  <div className="mb-3 min-h-[2rem] p-2 border border-slate-200 rounded-md bg-slate-50">
                    <div className="flex flex-wrap gap-2">
                      {/* Admin Group Capsule */}
                      {adminGroupAssigned && (
                        <Capsule 
                          text="Admin Group" 
                          onRemove={() => setAdminGroupAssigned(false)}
                          color="bg-blue-100 text-blue-800"
                          isGroup={true}
                        />
                      )}
                      
                      {/* Individual User Capsules */}
                      {formData.assignedUsers.map(userId => {
                        const user = users.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <Capsule 
                            key={userId}
                            text={user.name || user.email}
                            onRemove={() => toggleUserAssignment(userId)}
                          />
                        );
                      })}
                      
                      {!adminGroupAssigned && formData.assignedUsers.length === 0 && (
                        <span className="text-slate-400 text-sm">Chưa có ai được gán</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Add Admin Group Option */}
                  <div className="mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                      <input
                        type="checkbox"
                        checked={adminGroupAssigned}
                        onChange={() => setAdminGroupAssigned(!adminGroupAssigned)}
                      />
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-blue-700">Admin Group</div>
                          <div className="text-xs text-slate-500">Tất cả admin có thể truy cập bài thi này</div>
                        </div>
                      </div>
                    </label>
                  </div>
                  
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Tìm kiếm người dùng..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="border border-slate-300 rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center text-slate-500 py-4">
                        Không tìm thấy người dùng nào
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <label key={user.id} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                          <input
                            type="checkbox"
                            checked={formData.assignedUsers.includes(user.id)}
                            onChange={() => toggleUserAssignment(user.id)}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{user.name || user.email}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                            {user.role === 'admin' && (
                              <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">Admin</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTestId(null);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Hủy
              </button>
              <button 
                onClick={handleUpdateTest}
                disabled={!canSubmit() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang cập nhật...' : 'Cập nhật bài thi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Detail Modal */}
      {showDetailModal && selectedTestId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h4 className="text-xl font-semibold">Chi tiết bài thi</h4>
              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedTestId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <TestDetail 
                testId={selectedTestId} 
                onBack={() => {
                  setShowDetailModal(false);
                  setSelectedTestId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestManagement;

