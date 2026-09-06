import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../src/api';
import TestDetail from './TestDetail';
import { exportTestRankingsToExcel } from '../../src/utils/exportTestRankings';

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
  topic?: string | null;
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
  email?: string | null;
  username?: string | null;
}

interface KnowledgeBase {
  id: string;
  name: string;
  topic?: string | null;
  questions: any[];
  creatorEmail?: string;
}

interface User {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  role?: string;
}

interface UserGroup {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  members: User[];
}

const TestManagement: React.FC = () => {
  const [tests, setTests] = useState<Test[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [adminGroupAssigned, setAdminGroupAssigned] = useState(true); // Default admin group assigned
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>([]);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [creationMode, setCreationMode] = useState<'single' | 'batch'>('single');
  const [selectedBatchKbIds, setSelectedBatchKbIds] = useState<string[]>([]);

  // Topic states
  const [topicsList, setTopicsList] = useState<string[]>([]);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [testSearchTerm, setTestSearchTerm] = useState<string>('');
  const [isCreatingNewTopic, setIsCreatingNewTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    topic: '',
    questionCount: 20,
    timeLimit: 60, // minutes
    maxAttempts: 0, // default unlimited attempts
    startTime: '',
    endTime: '',
    shuffleQuestions: true,
    shuffleOptions: true,
    knowledgeSources: [{ knowledgeBaseId: '', percentage: 100 }] as KnowledgeSource[],
    assignedUsers: [] as string[]
  });

  // Batch creation helpers & calculations
  const batchTotalQuestions = useMemo(() => {
    return selectedBatchKbIds.reduce((sum, kbId) => {
      const kb = knowledgeBases.find(k => k.id === kbId);
      return sum + (kb?.questions?.length || 0);
    }, 0);
  }, [selectedBatchKbIds, knowledgeBases]);

  const batchTestPreview = useMemo(() => {
    const K = formData.questionCount;
    if (K <= 0 || batchTotalQuestions <= 0) return { fullTests: 0, remainder: 0, totalTests: 0, K };
    const fullTests = Math.floor(batchTotalQuestions / K);
    const remainder = batchTotalQuestions % K;
    const totalTests = fullTests + (remainder > 0 ? 1 : 0);
    return { fullTests, remainder, totalTests, K };
  }, [batchTotalQuestions, formData.questionCount]);

  const toggleBatchKbSelection = (kbId: string) => {
    setSelectedBatchKbIds(prev =>
      prev.includes(kbId) ? prev.filter(id => id !== kbId) : [...prev, kbId]
    );
  };

  const selectAllBatchKbs = () => {
    setSelectedBatchKbIds(knowledgeBases.map(kb => kb.id));
  };

  const unselectAllBatchKbs = () => {
    setSelectedBatchKbIds([]);
  };

  const adminUserIds = useMemo(
    () => users.filter(u => u.role === 'admin').map(u => u.id),
    [users]
  );

  const sortedTests = useMemo(() => {
    return [...tests].sort((a, b) => b.id.localeCompare(a.id));
  }, [tests]);

  const filteredTests = useMemo(() => {
    return sortedTests.filter(t => {
      const q = testSearchTerm.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.topic && t.topic.toLowerCase().includes(q));

      const matchTopic =
        selectedTopicFilter === 'all'
          ? true
          : selectedTopicFilter === '__NONE__'
          ? !t.topic
          : t.topic === selectedTopicFilter;

      return matchSearch && matchTopic;
    });
  }, [sortedTests, testSearchTerm, selectedTopicFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [testsData, basesData, usersData, groupsData, topicsData] = await Promise.all([
        api.adminListTests(),
        api.adminListKnowledgeBases(),
        api.adminListUsers(),
        api.adminListGroups().catch(() => []),
        api.listTopics().catch(() => [])
      ]);
      setTests(testsData);
      setKnowledgeBases(basesData);
      setUsers(usersData);
      setGroups(groupsData);
      if (Array.isArray(topicsData)) {
        setTopicsList(topicsData.map(t => t.name).filter(Boolean));
      }
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
      topic: '',
      questionCount: 20,
      timeLimit: 60,
      maxAttempts: 0,
      startTime: '',
      endTime: '',
      shuffleQuestions: true,
      shuffleOptions: true,
      knowledgeSources: [{ knowledgeBaseId: '', percentage: 100 }],
      assignedUsers: []
    });
    setAdminGroupAssigned(true);
    setAssignedGroupIds([]);
    setCreationMode('single');
    setSelectedBatchKbIds([]);
    setIsCreatingNewTopic(false);
    setCustomTopic('');
  };

  // Helper chọn tất cả CSKT thuộc chủ đề hiện tại
  const selectBatchKbsByCurrentTopic = (targetTopic?: string) => {
    const t = (targetTopic || (isCreatingNewTopic ? customTopic : formData.topic)).trim();
    if (!t) return;
    const matchedKbIds = knowledgeBases.filter(kb => kb.topic === t).map(kb => kb.id);
    setSelectedBatchKbIds(matchedKbIds);
  };

  /** Merge individual users + selected groups + admin group into final assignment IDs */
  const resolveAssignedUserIds = (): string[] => {
    const ids = new Set<string>(formData.assignedUsers);
    for (const groupId of assignedGroupIds) {
      const group = groups.find(g => g.id === groupId);
      group?.members.forEach(m => ids.add(m.id));
    }
    if (adminGroupAssigned) {
      adminUserIds.forEach(id => ids.add(id));
    }
    return [...ids];
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

  const getUserLabel = (user: { name?: string | null; email?: string | null; username?: string | null }) =>
    user.name || user.email || user.username || 'Unknown';

  const filteredUsers = users.filter(user => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (user.name?.toLowerCase().includes(q) ?? false) ||
      (user.email?.toLowerCase().includes(q) ?? false) ||
      (user.username?.toLowerCase().includes(q) ?? false)
    );
  });

  const toggleGroupAssignment = (groupId: string) => {
    setAssignedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const getTotalPercentage = () => {
    return formData.knowledgeSources.reduce((sum, ks) => sum + (ks.percentage || 0), 0);
  };

  const canSubmit = () => {
    const assignedCount = resolveAssignedUserIds().length;
    return (
      formData.name.trim() !== '' &&
      formData.questionCount > 0 &&
      formData.timeLimit > 0 &&
      formData.knowledgeSources.length > 0 &&
      formData.knowledgeSources.every(ks => ks.knowledgeBaseId && (ks.percentage || 0) > 0) &&
      Math.abs(getTotalPercentage() - 100) < 0.01 &&
      assignedCount > 0
    );
  };

  const canSubmitBatch = () => {
    const assignedCount = resolveAssignedUserIds().length;
    return (
      formData.name.trim() !== '' &&
      formData.questionCount > 0 &&
      formData.timeLimit > 0 &&
      selectedBatchKbIds.length > 0 &&
      batchTotalQuestions > 0 &&
      assignedCount > 0
    );
  };

  const handleCreateTest = async () => {
    const finalTopic = (isCreatingNewTopic ? customTopic : formData.topic).trim() || undefined;

    if (creationMode === 'batch') {
      if (!canSubmitBatch()) return;
      
      setLoading(true);
      try {
        const res = await api.adminCreateTestBatch({
          name: formData.name,
          description: formData.description,
          topic: finalTopic,
          questionCountPerTest: formData.questionCount,
          timeLimit: formData.timeLimit,
          maxAttempts: formData.maxAttempts,
          startTime: formData.startTime || undefined,
          endTime: formData.endTime || undefined,
          shuffleQuestions: formData.shuffleQuestions,
          shuffleOptions: formData.shuffleOptions,
          knowledgeBaseIds: selectedBatchKbIds,
          assignedUsers: resolveAssignedUserIds()
        });
        
        setShowCreateModal(false);
        resetForm();
        await loadData();
        alert(`Tạo bộ đề thi thành công! Đã tạo ${res.createdCount} đề thi từ ${res.totalQuestions} câu hỏi.`);
      } catch (error: any) {
        console.error('Failed to create test batch:', error);
        alert(error?.message || 'Có lỗi xảy ra khi tạo bộ đề thi. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!canSubmit()) return;
      
      setLoading(true);
      try {
        await api.adminCreateTest({
          name: formData.name,
          description: formData.description,
          topic: finalTopic,
          questionCount: formData.questionCount,
          timeLimit: formData.timeLimit,
          maxAttempts: formData.maxAttempts,
          startTime: formData.startTime || undefined,
          endTime: formData.endTime || undefined,
          shuffleQuestions: formData.shuffleQuestions,
          shuffleOptions: formData.shuffleOptions,
          knowledgeSources: formData.knowledgeSources,
          assignedUsers: resolveAssignedUserIds()
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
    }
  };

  const handleEditTest = (test: Test) => {
    setFormData({
      name: test.name,
      description: test.description || '',
      topic: test.topic || '',
      questionCount: test.questionCount,
      timeLimit: test.timeLimit,
      maxAttempts: test.maxAttempts, // Use exact value from database
      startTime: test.startTime ? new Date(test.startTime).toISOString().slice(0, 16) : '',
      endTime: test.endTime ? new Date(test.endTime).toISOString().slice(0, 16) : '',
      shuffleQuestions: test.shuffleQuestions ?? true,
      shuffleOptions: test.shuffleOptions ?? true,
      knowledgeSources: test.knowledgeSources,
      assignedUsers: test.assignedUsers.map(u => u.id)
    });
    setIsCreatingNewTopic(false);
    setCustomTopic('');
    // Admin group is considered assigned if every current admin is in the assignment
    const allAdminsAssigned =
      adminUserIds.length > 0 &&
      adminUserIds.every(id => test.assignedUsers.some(u => u.id === id));
    setAdminGroupAssigned(allAdminsAssigned);
    setAssignedGroupIds([]);
    setSelectedTestId(test.id);
    setShowEditModal(true);
  };

  const handleUpdateTest = async () => {
    if (!canSubmit() || !selectedTestId) return;
    
    const finalTopic = (isCreatingNewTopic ? customTopic : formData.topic).trim() || undefined;

    setLoading(true);
    try {
      await api.adminUpdateTest(selectedTestId, {
        name: formData.name,
        description: formData.description,
        topic: finalTopic,
        questionCount: formData.questionCount,
        timeLimit: formData.timeLimit,
        maxAttempts: formData.maxAttempts,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        shuffleQuestions: formData.shuffleQuestions,
        shuffleOptions: formData.shuffleOptions,
        knowledgeSources: formData.knowledgeSources,
        assignedUsers: resolveAssignedUserIds()
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

  const toggleExportSelection = (testId: string) => {
    setSelectedExportIds(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };

  const handleExportSelected = async () => {
    if (selectedExportIds.length === 0) {
      alert('Hãy chọn ít nhất một bài thi để xuất.');
      return;
    }
    setExporting(true);
    try {
      const { rows } = await api.adminExportTestRankings(selectedExportIds);
      if (!rows.length) {
        alert('Không có kết quả nào để xuất.');
        return;
      }
      exportTestRankingsToExcel(rows, `ket-qua-nhieu-bai-thi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Xuất Excel thất bại.');
    } finally {
      setExporting(false);
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
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-semibold text-slate-800">Quản lý bài thi</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExportSelected}
            disabled={exporting || selectedExportIds.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? 'Đang xuất...' : `Xuất Excel (${selectedExportIds.length})`}
          </button>
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
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h4 className="text-lg font-semibold text-slate-800">Danh sách bài thi</h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm bài thi..."
                value={testSearchTerm}
                onChange={e => setTestSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent w-full sm:w-56"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={selectedTopicFilter}
              onChange={e => setSelectedTopicFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="all">Tất cả chủ đề</option>
              {topicsList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__NONE__">Chưa có chủ đề</option>
            </select>
          </div>
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
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filteredTests.length > 0 && selectedExportIds.length === filteredTests.length}
                      onChange={(e) => {
                        setSelectedExportIds(e.target.checked ? filteredTests.map(t => t.id) : []);
                      }}
                      title="Chọn tất cả để xuất Excel"
                    />
                  </th>
                  <th className="px-6 py-3 font-medium text-slate-600">Tên bài thi</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Chủ đề</th>
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
                {filteredTests.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                      Không tìm thấy bài thi nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredTests.map(test => (
                    <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedExportIds.includes(test.id)}
                          onChange={() => toggleExportSelection(test.id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{test.name}</div>
                        {test.description && (
                          <div className="text-sm text-slate-500">{test.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {test.topic ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {test.topic}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có</span>
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
                ))
              )}
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
            
            {/* Mode selection tab */}
            <div className="flex border-b mb-6 border-slate-200">
              <button
                type="button"
                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
                  creationMode === 'single'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setCreationMode('single')}
              >
                1. Tạo 1 đề thi đơn lẻ
              </button>
              <button
                type="button"
                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
                  creationMode === 'batch'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setCreationMode('batch')}
              >
                2. Tạo bộ đề thi tự động (Chia theo tỷ lệ chủ đề)
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-800 border-b pb-2">Thông tin cơ bản</h5>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {creationMode === 'batch' ? 'Tên bộ đề thi *' : 'Tên bài thi *'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder={creationMode === 'batch' ? 'Ví dụ: Đề thi Giữa kỳ Q3...' : 'Nhập tên bài thi...'}
                  />
                </div>
                
                <div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nhập mô tả bài thi..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Chủ đề (Topic)
                  </label>
                  <select
                    value={isCreatingNewTopic ? '__NEW__' : formData.topic}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingNewTopic(true);
                      } else {
                        setIsCreatingNewTopic(false);
                        setFormData(prev => ({ ...prev, topic: e.target.value }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm bg-white"
                  >
                    <option value="">-- Không phân loại chủ đề --</option>
                    {topicsList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__NEW__">+ Nhập chủ đề mới...</option>
                  </select>
                  {isCreatingNewTopic && (
                    <input
                      type="text"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      placeholder="Nhập tên chủ đề mới..."
                      className="mt-2 w-full px-3 py-2 border border-sky-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                      autoFocus
                    />
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {creationMode === 'batch' ? 'Số câu / 1 đề *' : 'Số câu hỏi *'}
                    </label>
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

                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Tùy chọn xáo trộn đề thi</label>
                  <div className="flex flex-col space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.shuffleQuestions}
                        onChange={e => setFormData(prev => ({ ...prev, shuffleQuestions: e.target.checked }))}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                      <span className="font-medium">Đảo thứ tự câu hỏi mỗi lần thi</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.shuffleOptions}
                        onChange={e => setFormData(prev => ({ ...prev, shuffleOptions: e.target.checked }))}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                      <span className="font-medium">Đảo thứ tự các đáp án trong câu hỏi</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column - Knowledge Sources & Users */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-800 border-b pb-2">Cấu hình nâng cao</h5>
                
                {/* Knowledge Sources */}
                {creationMode === 'batch' ? (
                  <div>
                    <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Chọn các chủ đề (Cơ sở kiến thức) *
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {Boolean((isCreatingNewTopic ? customTopic : formData.topic).trim()) && (
                          <button
                            type="button"
                            onClick={() => selectBatchKbsByCurrentTopic()}
                            className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
                            title="Chọn tất cả CSKT có cùng chủ đề này"
                          >
                            Chọn theo chủ đề
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={selectAllBatchKbs}
                          className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={unselectAllBatchKbs}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 bg-slate-50">
                      {knowledgeBases.map(kb => {
                        const count = kb.questions?.length || 0;
                        const isSelected = selectedBatchKbIds.includes(kb.id);
                        const pct = batchTotalQuestions > 0 && isSelected
                          ? ((count / batchTotalQuestions) * 100).toFixed(1)
                          : '0';
                        return (
                          <label key={kb.id} className="flex items-center justify-between p-2 hover:bg-white rounded border border-transparent hover:border-slate-200 cursor-pointer text-sm">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBatchKbSelection(kb.id)}
                              />
                              <span className="font-medium text-slate-800">{kb.name}</span>
                              {kb.topic && (
                                <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                  {kb.topic}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">{count} câu</span>
                              {isSelected && (
                                <span className="ml-2 text-sky-600 font-semibold">({pct}%)</span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Batch Summary Box */}
                    {selectedBatchKbIds.length > 0 && (
                      <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-900 space-y-1">
                        <div className="font-bold text-sky-800">Dự kiến tạo bộ đề thi:</div>
                        <div>• Tổng số câu hỏi khả dụng: <span className="font-bold">{batchTotalQuestions} câu</span></div>
                        <div>• Số câu hỏi mỗi đề: <span className="font-bold">{formData.questionCount} câu</span></div>
                        <div>
                          • Số lượng đề sẽ tạo: <span className="font-bold text-sky-700">{batchTestPreview.totalTests} đề thi</span>
                          {batchTestPreview.totalTests > 0 && (
                            <span className="ml-1 text-slate-600">
                              ({batchTestPreview.fullTests} đề {batchTestPreview.K} câu
                              {batchTestPreview.remainder > 0 ? ` + 1 đề dư ${batchTestPreview.remainder} câu` : ''})
                            </span>
                          )}
                        </div>
                        <div className="text-emerald-700 font-medium pt-1 border-t border-sky-200">
                          ✓ Các đề sẽ được tạo ngẫu nhiên theo tỷ lệ chủ đề và đảm bảo không lặp câu hỏi giữa các đề thi.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
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
                )}
                
                {/* User Assignment */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Gán cho người dùng * ({resolveAssignedUserIds().length} người sẽ được gán)
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
                      {adminGroupAssigned && (
                        <Capsule 
                          text={`Admin Group (${adminUserIds.length})`}
                          onRemove={() => setAdminGroupAssigned(false)}
                          color="bg-blue-100 text-blue-800"
                          isGroup={true}
                        />
                      )}
                      {assignedGroupIds.map(groupId => {
                        const group = groups.find(g => g.id === groupId);
                        if (!group) return null;
                        return (
                          <Capsule
                            key={groupId}
                            text={`${group.name} (${group.memberCount})`}
                            onRemove={() => toggleGroupAssignment(groupId)}
                            color="bg-indigo-100 text-indigo-800"
                            isGroup={true}
                          />
                        );
                      })}
                      {formData.assignedUsers.map(userId => {
                        const user = users.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <Capsule 
                            key={userId}
                            text={getUserLabel(user)}
                            onRemove={() => toggleUserAssignment(userId)}
                          />
                        );
                      })}
                      {resolveAssignedUserIds().length === 0 && (
                        <span className="text-slate-400 text-sm">Chưa có ai được gán</span>
                      )}
                    </div>
                  </div>

                  {/* Groups */}
                  {groups.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-slate-600 mb-1">Chọn theo nhóm</div>
                      <div className="border border-slate-300 rounded-md max-h-32 overflow-y-auto p-2 space-y-1">
                        {groups.map(group => (
                          <label key={group.id} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                            <input
                              type="checkbox"
                              checked={assignedGroupIds.includes(group.id)}
                              onChange={() => toggleGroupAssignment(group.id)}
                            />
                            <div>
                              <div className="text-sm font-medium text-indigo-700">{group.name}</div>
                              <div className="text-xs text-slate-500">{group.memberCount} thành viên</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
                          <div className="text-xs text-slate-500">Gán cho tất cả tài khoản admin ({adminUserIds.length})</div>
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
                            <div className="text-sm font-medium">{getUserLabel(user)}</div>
                            <div className="text-xs text-slate-500">{user.email || user.username || '-'}</div>
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
                disabled={creationMode === 'batch' ? (!canSubmitBatch() || loading) : (!canSubmit() || loading)}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? (creationMode === 'batch' ? 'Đang tạo bộ đề...' : 'Đang tạo...')
                  : (creationMode === 'batch' ? `Tạo bộ ${batchTestPreview.totalTests || ''} đề thi` : 'Tạo bài thi')}
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
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nhập mô tả bài thi..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Chủ đề (Topic)
                  </label>
                  <select
                    value={isCreatingNewTopic ? '__NEW__' : formData.topic}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingNewTopic(true);
                      } else {
                        setIsCreatingNewTopic(false);
                        setFormData(prev => ({ ...prev, topic: e.target.value }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm bg-white"
                  >
                    <option value="">-- Không phân loại chủ đề --</option>
                    {topicsList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__NEW__">+ Nhập chủ đề mới...</option>
                  </select>
                  {isCreatingNewTopic && (
                    <input
                      type="text"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      placeholder="Nhập tên chủ đề mới..."
                      className="mt-2 w-full px-3 py-2 border border-sky-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                      autoFocus
                    />
                  )}
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

                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Tùy chọn xáo trộn đề thi</label>
                  <div className="flex flex-col space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.shuffleQuestions}
                        onChange={e => setFormData(prev => ({ ...prev, shuffleQuestions: e.target.checked }))}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                      <span className="font-medium">Đảo thứ tự câu hỏi mỗi lần thi</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.shuffleOptions}
                        onChange={e => setFormData(prev => ({ ...prev, shuffleOptions: e.target.checked }))}
                        className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                      <span className="font-medium">Đảo thứ tự các đáp án trong câu hỏi</span>
                    </label>
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
                      Gán cho người dùng * ({resolveAssignedUserIds().length} người sẽ được gán)
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

                  <div className="mb-3 min-h-[2rem] p-2 border border-slate-200 rounded-md bg-slate-50">
                    <div className="flex flex-wrap gap-2">
                      {adminGroupAssigned && (
                        <Capsule 
                          text={`Admin Group (${adminUserIds.length})`}
                          onRemove={() => setAdminGroupAssigned(false)}
                          color="bg-blue-100 text-blue-800"
                          isGroup={true}
                        />
                      )}
                      {assignedGroupIds.map(groupId => {
                        const group = groups.find(g => g.id === groupId);
                        if (!group) return null;
                        return (
                          <Capsule
                            key={groupId}
                            text={`${group.name} (${group.memberCount})`}
                            onRemove={() => toggleGroupAssignment(groupId)}
                            color="bg-indigo-100 text-indigo-800"
                            isGroup={true}
                          />
                        );
                      })}
                      {formData.assignedUsers.map(userId => {
                        const user = users.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <Capsule 
                            key={userId}
                            text={getUserLabel(user)}
                            onRemove={() => toggleUserAssignment(userId)}
                          />
                        );
                      })}
                      {resolveAssignedUserIds().length === 0 && (
                        <span className="text-slate-400 text-sm">Chưa có ai được gán</span>
                      )}
                    </div>
                  </div>

                  {groups.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-slate-600 mb-1">Chọn theo nhóm</div>
                      <div className="border border-slate-300 rounded-md max-h-32 overflow-y-auto p-2 space-y-1">
                        {groups.map(group => (
                          <label key={group.id} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                            <input
                              type="checkbox"
                              checked={assignedGroupIds.includes(group.id)}
                              onChange={() => toggleGroupAssignment(group.id)}
                            />
                            <div>
                              <div className="text-sm font-medium text-indigo-700">{group.name}</div>
                              <div className="text-xs text-slate-500">{group.memberCount} thành viên</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

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
                          <div className="text-xs text-slate-500">Gán cho tất cả tài khoản admin ({adminUserIds.length})</div>
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
                            <div className="text-sm font-medium">{getUserLabel(user)}</div>
                            <div className="text-xs text-slate-500">{user.email || user.username || '-'}</div>
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

