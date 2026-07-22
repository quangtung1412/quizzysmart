import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';
import { exportTestRankingsToExcel, formatDurationDisplay } from '../../src/utils/exportTestRankings';

interface TestDetailProps {
  testId: string;
  onBack: () => void;
}

const TestDetail: React.FC<TestDetailProps> = ({ testId, onBack }) => {
  const [test, setTest] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadTestDetail = async () => {
      try {
        setLoading(true);
        const [testData, rankingData] = await Promise.all([
          api.adminListTests().then(tests => tests.find(t => t.id === testId)),
          api.adminTestRanking(testId)
        ]);
        setTest(testData);
        setRanking(rankingData);
      } catch (error) {
        console.error('Failed to load test detail:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTestDetail();
  }, [testId]);

  const handleExportExcel = () => {
    if (ranking.length === 0) {
      alert('Chưa có kết quả để xuất.');
      return;
    }
    setExporting(true);
    try {
      exportTestRankingsToExcel(
        ranking.map(r => ({
          testName: test?.name || '',
          userName: r.userName,
          userEmail: r.userEmail,
          username: r.username,
          score: r.score,
          startedAt: r.startedAt,
          durationSeconds: r.durationSeconds,
          correctAnswers: r.correctAnswers,
          totalQuestions: r.totalQuestions
        })),
        `ket-qua-${(test?.name || 'bai-thi').replace(/[^\w\-]+/g, '_')}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Không tìm thấy bài thi.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-md">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          <h2 className="text-2xl font-bold text-slate-900">{test.name}</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting || ranking.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            test.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {test.isActive ? 'Đang hoạt động' : 'Tạm dừng'}
          </span>
        </div>
      </div>

      {/* Test Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Thông tin bài thi</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600">Số câu hỏi</div>
            <div className="text-2xl font-bold text-blue-900">{test.questionCount}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600">Thời gian</div>
            <div className="text-2xl font-bold text-green-900">{test.timeLimit} phút</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600">Được gán</div>
            <div className="text-2xl font-bold text-purple-900">{test.assignedUsers.length} người</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600">Lượt thi</div>
            <div className="text-2xl font-bold text-orange-900">{ranking.length}</div>
          </div>
        </div>

        {test.description && (
          <div className="mt-4">
            <div className="text-sm font-medium text-slate-700">Mô tả</div>
            <div className="text-slate-600">{test.description}</div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {test.startTime && (
            <div>
              <div className="text-sm font-medium text-slate-700">Thời gian bắt đầu</div>
              <div className="text-slate-600">
                {new Date(test.startTime).toLocaleString('vi-VN')}
              </div>
            </div>
          )}
          {test.endTime && (
            <div>
              <div className="text-sm font-medium text-slate-700">Thời gian kết thúc</div>
              <div className="text-slate-600">
                {new Date(test.endTime).toLocaleString('vi-VN')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Knowledge Sources */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Cơ sở kiến thức</h3>
        <div className="space-y-2">
          {test.knowledgeSources.map((source: any, index: number) => (
            <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded">
              <span className="font-medium">Cơ sở kiến thức {index + 1}</span>
              <span className="text-sky-600 font-semibold">{source.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assigned Users */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Người dùng được gán ({test.assignedUsers.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {test.assignedUsers.map((user: any) => (
            <div key={user.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded">
              <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-sky-600">
                  {(user.name || user.email || user.username || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {user.name || user.email || user.username || 'Unknown'}
                </div>
                <div className="text-xs text-slate-500 truncate">{user.email || user.username || '-'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rankings */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bảng xếp hạng</h3>
          <button
            onClick={handleExportExcel}
            disabled={exporting || ranking.length === 0}
            className="px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50"
          >
            Xuất Excel
          </button>
        </div>
        {ranking.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            Chưa có ai hoàn thành bài thi này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Xếp hạng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Người dùng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Điểm số
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Câu đúng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Thời gian bắt đầu
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Thời gian làm bài
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ranking.map((entry, index) => (
                  <tr key={entry.attemptId} className={index < 3 ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {index === 0 && <span className="text-yellow-500 mr-2">🥇</span>}
                        {index === 1 && <span className="text-gray-400 mr-2">🥈</span>}
                        {index === 2 && <span className="text-orange-600 mr-2">🥉</span>}
                        <span className="font-semibold">{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {entry.userName || entry.userEmail || entry.username || '-'}
                      </div>
                      <div className="text-xs text-slate-500">{entry.userEmail || entry.username}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-900">
                        {Number(entry.score).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">
                      {entry.correctAnswers ?? 0}/{entry.totalQuestions ?? 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                      {entry.startedAt ? new Date(entry.startedAt).toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDurationDisplay(entry.durationSeconds)}
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

export default TestDetail;
