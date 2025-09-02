import React, { useState, useEffect } from 'react';
import { api } from '../src/api';
import { AppUser, UserAnswer, Question } from '../types';

interface TestAttempt {
  id: string;
  score: number | null;
  completedAt: string | null;
  startedAt: string;
  duration: number | null; // in seconds
  totalQuestions: number;
  correctAnswers: number;
  status: 'completed' | 'in-progress';
}

interface TestDetailScreenProps {
  testId: string;
  user: AppUser;
  onBack: () => void;
  onViewAttemptDetails: (attemptId: string) => void;
}

type SortField = 'startedAt' | 'score' | 'duration' | 'correctAnswers';
type SortOrder = 'asc' | 'desc';

const TestDetailScreen: React.FC<TestDetailScreenProps> = ({
  testId,
  user,
  onBack,
  onViewAttemptDetails
}) => {
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('startedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [testInfo, setTestInfo] = useState<any>(null);

  useEffect(() => {
    loadTestDetails();
  }, [testId]);

  const loadTestDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load test attempts
      const attemptsData = await api.getTestAttempts(testId, user.email);
      setAttempts(attemptsData);
      
      // Load basic test info (view only, skip attempt limits)
      const testData = await api.getTestById(testId, user.email, true);
      setTestInfo(testData);
      
    } catch (err: any) {
      console.error('Failed to load test details:', err);
      setError(err.message || 'Không thể tải chi tiết bài thi');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedAttempts = [...attempts].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'startedAt':
        aValue = new Date(a.startedAt).getTime();
        bValue = new Date(b.startedAt).getTime();
        break;
      case 'score':
        aValue = a.score || 0;
        bValue = b.score || 0;
        break;
      case 'duration':
        aValue = a.duration || 0;
        bValue = b.duration || 0;
        break;
      case 'correctAnswers':
        aValue = a.correctAnswers;
        bValue = b.correctAnswers;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div>
        <p className="text-slate-600">Đang tải chi tiết bài thi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-500 mb-4">❌ Có lỗi xảy ra</div>
        <p className="text-slate-600 mb-6">{error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const completedAttempts = attempts.filter(a => a.status === 'completed');
  const bestScore = completedAttempts.length > 0 ? Math.max(...completedAttempts.map(a => a.score || 0)) : null;
  const averageScore = completedAttempts.length > 0 
    ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length 
    : null;
  const fastestTime = completedAttempts.length > 0 
    ? Math.min(...completedAttempts.map(a => a.duration || Infinity).filter(d => d !== Infinity))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-transparent rounded-md hover:bg-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Chi tiết bài thi</h2>
          <p className="text-slate-600">{testInfo?.name}</p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="text-3xl font-bold text-sky-600 mb-2">{attempts.length}</div>
          <div className="text-slate-600 text-sm">Tổng số lượt thi</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className={`text-3xl font-bold mb-2 ${getScoreColor(bestScore)}`}>
            {bestScore !== null ? `${bestScore}%` : 'N/A'}
          </div>
          <div className="text-slate-600 text-sm">Điểm cao nhất</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {formatTime(fastestTime)}
          </div>
          <div className="text-slate-600 text-sm">Thời gian nhanh nhất</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {averageScore !== null ? `${Math.round(averageScore)}%` : 'N/A'}
          </div>
          <div className="text-slate-600 text-sm">Điểm trung bình</div>
        </div>
      </div>

      {/* Test Info */}
      {testInfo && (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Thông tin bài thi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Tổng số câu hỏi:</span>
              <div className="font-medium text-slate-800">{testInfo.questionCount} câu</div>
            </div>
            <div>
              <span className="text-slate-500">Thời gian tối đa:</span>
              <div className="font-medium text-slate-800">{testInfo.timeLimit} phút</div>
            </div>
            <div>
              <span className="text-slate-500">Số lượt thi tối đa:</span>
              <div className="font-medium text-slate-800">
                {testInfo.maxAttempts === 0 ? 'Không giới hạn' : `${testInfo.maxAttempts} lượt`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attempts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Lịch sử làm bài</h3>
        </div>
        
        {attempts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-slate-400 mb-4">📋</div>
            <p className="text-slate-600">Chưa có lượt thi nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('startedAt')}
                      className="flex items-center gap-1 hover:text-slate-700"
                    >
                      Thời gian bắt đầu
                      {getSortIcon('startedAt')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('score')}
                      className="flex items-center gap-1 hover:text-slate-700"
                    >
                      Điểm số
                      {getSortIcon('score')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('correctAnswers')}
                      className="flex items-center gap-1 hover:text-slate-700"
                    >
                      Đúng/Tổng
                      {getSortIcon('correctAnswers')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('duration')}
                      className="flex items-center gap-1 hover:text-slate-700"
                    >
                      Thời gian làm bài
                      {getSortIcon('duration')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(attempt.startedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {attempt.status === 'completed' ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Hoàn thành
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          Đang làm
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-lg font-bold ${getScoreColor(attempt.score)}`}>
                        {attempt.score !== null ? `${attempt.score}%` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {attempt.correctAnswers}/{attempt.totalQuestions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {formatTime(attempt.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {attempt.status === 'completed' && (
                        <button
                          onClick={() => onViewAttemptDetails(attempt.id)}
                          className="text-sky-600 hover:text-sky-800 text-sm font-medium"
                        >
                          Xem chi tiết
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestDetailScreen;
