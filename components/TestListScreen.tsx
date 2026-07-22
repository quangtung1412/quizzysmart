import React, { useState, useEffect, useCallback } from 'react';
import { api, getUserIdentifier } from '../src/api';
import { AppUser } from '../types';

interface Test {
  id: string;
  name: string;
  description?: string;
  questionCount: number;
  timeLimit: number; // in minutes
  maxAttempts: number;
  usedAttempts: number;
  remainingAttempts: number | null; // null = unlimited, 0 = no attempts left
  startTime?: string;
  endTime?: string;
  isActive: boolean;
  createdAt: string;
  // Statistics
  bestScore?: number | null;
  fastestTime?: number | null; // in seconds
  averageScore?: number | null;
}

interface TestListScreenProps {
  user: AppUser;
  onAdminPanel: () => void;
  onKnowledgeBase: () => void;
  onStartTest: (testId: string) => void;
  onViewTestDetails: (testId: string) => void;
  onBack?: () => void;
}

const TestListScreen: React.FC<TestListScreenProps> = ({
  user,
  onAdminPanel,
  onKnowledgeBase,
  onStartTest,
  onViewTestDetails,
  onBack
}) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [filteredTests, setFilteredTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const userIdentifier = getUserIdentifier(user);

  const loadTests = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      // Session auth preferred; identifier supports username-only accounts
      const assignedTests = await api.getUserTests(userIdentifier || undefined);
      const activeTests = assignedTests.filter((test: Test) => test.isActive);

      const testsWithStats = await Promise.all(
        activeTests.map(async (test: Test) => {
          try {
            const stats = await api.getTestStatistics(test.id, userIdentifier);
            return {
              ...test,
              bestScore: stats.bestScore,
              fastestTime: stats.fastestTime,
              averageScore: stats.averageScore
            };
          } catch (error) {
            console.error(`Failed to load stats for test ${test.id}:`, error);
            return test;
          }
        })
      );

      setTests(testsWithStats);
    } catch (error) {
      console.error('Failed to load tests:', error);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [userIdentifier]);

  useEffect(() => {
    loadTests(true);
  }, [loadTests]);

  // Refetch when user returns to the tab so newly assigned tests appear without hard reload
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadTests(false);
      }
    };
    const onFocus = () => loadTests(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadTests]);

  useEffect(() => {
    // Filter tests based on search query
    if (searchQuery.trim() === '') {
      setFilteredTests(tests);
    } else {
      const filtered = tests.filter(test =>
        test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (test.description && test.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredTests(filtered);
    }
  }, [tests, searchQuery]);

  const isTestAvailable = (test: Test) => {
    const now = new Date();
    if (test.startTime && new Date(test.startTime) > now) {
      return false; // Test hasn't started yet
    }
    if (test.endTime && new Date(test.endTime) < now) {
      return false; // Test has ended
    }
    if (test.remainingAttempts === 0) {
      return false; // No attempts left
    }
    return true;
  };

  const getTestStatus = (test: Test) => {
    const now = new Date();
    if (test.startTime && new Date(test.startTime) > now) {
      return { status: 'upcoming', text: 'Sắp diễn ra', color: 'bg-blue-100 text-blue-800' };
    }
    if (test.endTime && new Date(test.endTime) < now) {
      return { status: 'ended', text: 'Đã kết thúc', color: 'bg-gray-100 text-gray-800' };
    }
    if (test.remainingAttempts === 0) {
      return { status: 'no-attempts', text: 'Hết lượt thi', color: 'bg-red-100 text-red-800' };
    }
    return { status: 'active', text: 'Đang diễn ra', color: 'bg-green-100 text-green-800' };
  };

  const getAttemptsText = (test: Test) => {
    if (test.maxAttempts === 0) {
      return `Đã thi: ${test.usedAttempts} lần (Không giới hạn)`;
    }
    return `Còn lại: ${test.remainingAttempts} / ${test.maxAttempts} lượt`;
  };

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div>
        <p className="text-slate-600">Đang tải danh sách bài thi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0">
      {/* Header with navigation */}
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
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Danh sách bài thi</h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">Các bài thi đã được gán cho bạn</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={onKnowledgeBase}
            className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors min-h-[44px] text-sm sm:text-base"
          >
            <span className="sm:hidden">📚 Kiến thức</span>
            <span className="hidden sm:inline">📚 Cơ sở kiến thức</span>
          </button>
          {(user.role === 'admin' || user.isAdmin === true) && (
            <button
              onClick={onAdminPanel}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 min-h-[44px] text-sm sm:text-base"
            >
              <span className="sm:hidden">⚙️ Admin</span>
              <span className="hidden sm:inline">⚙️ Admin Panel</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm bài thi theo tên..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-9 sm:pl-10 pr-3 py-2.5 sm:py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-600 focus:ring-1 focus:ring-sky-600 focus:border-sky-600 text-sm sm:text-base"
        />
      </div>

      {/* Tests Grid */}
      {filteredTests.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">
            {searchQuery ? 'Không tìm thấy bài thi' : 'Chưa có bài thi nào'}
          </h3>
          <p className="text-sm sm:text-base text-slate-500">
            {searchQuery
              ? `Không có bài thi nào khớp với "${searchQuery}"`
              : 'Chưa có bài thi nào được gán cho bạn'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-sky-600 hover:text-sky-800 font-medium text-sm min-h-[44px] px-4 py-2"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredTests.map((test) => {
            const status = getTestStatus(test);
            const available = isTestAvailable(test);

            return (
              <div
                key={test.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Test Status */}
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <span className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full ${status.color}`}>
                    {status.text}
                  </span>
                  <div className="text-right text-xs text-slate-500">
                    {new Date(test.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>

                {/* Test Info */}
                <div className="space-y-2 sm:space-y-3">
                  <h3 className="font-semibold text-slate-900 text-base sm:text-lg leading-tight">
                    {test.name}
                  </h3>

                  {test.description && (
                    <p className="text-slate-600 text-sm line-clamp-2">
                      {test.description}
                    </p>
                  )}

                  {/* Test Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-slate-600">{test.questionCount} câu hỏi</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-slate-600">{test.timeLimit} phút</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-slate-600">{getAttemptsText(test)}</span>
                    </div>
                  </div>

                  {/* Statistics */}
                  {test.usedAttempts > 0 && (
                    <div className="mt-3 sm:mt-4 p-3 bg-slate-50 rounded-lg">
                      <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Thống kê cá nhân</h4>
                      <div className="grid grid-cols-3 gap-1 sm:gap-2 text-xs">
                        <div className="text-center">
                          <div className={`text-sm sm:text-lg font-bold ${test.bestScore !== null && test.bestScore >= 80 ? 'text-green-600' :
                            test.bestScore !== null && test.bestScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                            {test.bestScore !== null ? `${test.bestScore}%` : 'N/A'}
                          </div>
                          <div className="text-slate-500 text-xs">Điểm cao nhất</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm sm:text-lg font-bold text-blue-600">
                            {formatTime(test.fastestTime)}
                          </div>
                          <div className="text-slate-500 text-xs">Nhanh nhất</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm sm:text-lg font-bold text-purple-600">
                            {test.averageScore !== null ? `${test.averageScore}%` : 'N/A'}
                          </div>
                          <div className="text-slate-500 text-xs">Trung bình</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attempts Warning */}
                  {test.remainingAttempts === 0 && (
                    <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-red-700 text-sm font-medium">Đã hết lượt thi</span>
                    </div>
                  )}
                  {test.remainingAttempts !== null && test.remainingAttempts <= 1 && test.remainingAttempts > 0 && (
                    <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-yellow-700 text-sm font-medium">Chỉ còn {test.remainingAttempts} lượt thi</span>
                    </div>
                  )}

                  {/* Time Information */}
                  {(test.startTime || test.endTime) && (
                    <div className="text-xs text-slate-500 space-y-1">
                      {test.startTime && (
                        <div>Bắt đầu: {new Date(test.startTime).toLocaleString('vi-VN')}</div>
                      )}
                      {test.endTime && (
                        <div>Kết thúc: {new Date(test.endTime).toLocaleString('vi-VN')}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 sm:mt-6 space-y-2">
                  <button
                    onClick={() => onStartTest(test.id)}
                    disabled={!available}
                    className={`w-full py-2.5 sm:py-3 px-4 rounded-lg font-medium transition-colors min-h-[44px] text-sm sm:text-base ${available
                      ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm hover:shadow'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                  >
                    {available ? 'Bắt đầu làm bài' : 'Không khả dụng'}
                  </button>

                  {test.usedAttempts > 0 && (
                    <button
                      onClick={() => onViewTestDetails(test.id)}
                      className="w-full py-2.5 px-4 rounded-lg font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 min-h-[44px] text-sm sm:text-base"
                    >
                      <span className="sm:hidden">📊 Chi tiết</span>
                      <span className="hidden sm:inline">📊 Xem chi tiết</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TestListScreen;
