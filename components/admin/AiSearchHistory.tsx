import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../src/api';

interface SearchHistoryItem {
    id: number;
    userId: number;
    user: {
        id: number;
        username: string;
        email: string;
        name: string;
    };
    recognizedText: string | null;
    matchedQuestionId: number | null;
    confidence: number;
    modelUsed: string;
    modelPriority: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    responseTime: number;
    success: boolean;
    errorMessage: string | null;
    createdAt: string;
}

interface ModelStats {
    total: number;
    success: number;
    failed: number;
    avgResponseTime: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
}

interface SearchHistoryResponse {
    history: SearchHistoryItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: {
        byModel: { [model: string]: ModelStats };
        totalSearches: number;
        successRate: string;
    };
}

export default function AiSearchHistory() {
    const [data, setData] = useState<SearchHistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [page, setPage] = useState(1);
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [modelUsed, setModelUsed] = useState('');
    const [success, setSuccess] = useState<string>('');
    const [minConfidence, setMinConfidence] = useState('');
    const [maxConfidence, setMaxConfidence] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // State for expanded questions
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: '50'
            });

            if (userId) params.append('userId', userId);
            if (username) params.append('username', username);
            if (modelUsed) params.append('modelUsed', modelUsed);
            if (success !== '') params.append('success', success);
            if (minConfidence) params.append('minConfidence', minConfidence);
            if (maxConfidence) params.append('maxConfidence', maxConfidence);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await fetch(`${API_BASE}/api/admin/ai-search-history?${params.toString()}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch AI search history');
            }

            const result = await response.json();
            setData(result);
        } catch (err: any) {
            console.error('Error fetching AI search history:', err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [page, userId, username, modelUsed, success, minConfidence, maxConfidence, startDate, endDate]);

    const applyFilters = () => {
        setPage(1); // Reset to first page when filters change
        fetchHistory();
    };

    const clearFilters = () => {
        setUserId('');
        setUsername('');
        setModelUsed('');
        setSuccess('');
        setMinConfidence('');
        setMaxConfidence('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const toggleQuestionExpansion = (id: number) => {
        const newExpanded = new Set(expandedQuestions);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedQuestions(newExpanded);
    };

    const truncateText = (text: string, maxLength: number = 100) => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-600">Đang tải...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Lỗi: {error}</p>
                <button
                    onClick={fetchHistory}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Thử lại
                </button>
            </div>
        );
    }

    if (!data) return null;

    const availableModels = Object.keys(data.stats.byModel);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Lịch Sử Tìm Kiếm AI</h2>
                <button
                    onClick={fetchHistory}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={loading}
                >
                    {loading ? 'Đang tải...' : '🔄 Làm mới'}
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <div className="text-sm opacity-90">Tổng số tìm kiếm</div>
                    <div className="text-3xl font-bold mt-2">{data.stats.totalSearches.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <div className="text-sm opacity-90">Tỷ lệ thành công</div>
                    <div className="text-3xl font-bold mt-2">{data.stats.successRate}%</div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                    <div className="text-sm opacity-90">Số model đã dùng</div>
                    <div className="text-3xl font-bold mt-2">{availableModels.length}</div>
                </div>
            </div>

            {/* Model Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Thống Kê Theo Model</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Model</th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Tổng</th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Thành công</th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Thất bại</th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Avg Time (ms)</th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total Tokens</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {availableModels.map(model => {
                                const stats = data.stats.byModel[model];
                                const successRate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(1) : 0;

                                return (
                                    <tr key={model} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm text-gray-900">{model}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600 text-right">{stats.total}</td>
                                        <td className="px-4 py-2 text-sm text-green-600 text-right">
                                            {stats.success} ({successRate}%)
                                        </td>
                                        <td className="px-4 py-2 text-sm text-red-600 text-right">{stats.failed}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                                            {Math.round(stats.avgResponseTime)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-600 text-right">
                                            {stats.totalTokens.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Bộ Lọc</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                        <input
                            type="number"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Nhập User ID"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Nhập username hoặc email"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                        <select
                            value={modelUsed}
                            onChange={(e) => setModelUsed(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Chọn model"
                        >
                            <option value="">Tất cả</option>
                            {availableModels.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                        <select
                            value={success}
                            onChange={(e) => setSuccess(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Chọn trạng thái"
                        >
                            <option value="">Tất cả</option>
                            <option value="true">Thành công</option>
                            <option value="false">Thất bại</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Độ tin cậy tối thiểu (%)</label>
                        <input
                            type="number"
                            value={minConfidence}
                            onChange={(e) => setMinConfidence(e.target.value)}
                            placeholder="0"
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Độ tin cậy tối đa (%)</label>
                        <input
                            type="number"
                            value={maxConfidence}
                            onChange={(e) => setMaxConfidence(e.target.value)}
                            placeholder="100"
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Chọn ngày bắt đầu"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Chọn ngày kết thúc"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                    <button
                        onClick={applyFilters}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Áp dụng bộ lọc
                    </button>
                    <button
                        onClick={clearFilters}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                        Xóa bộ lọc
                    </button>
                </div>
            </div>

            {/* Search History Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Câu hỏi</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Độ tin cậy</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tokens</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Time (ms)</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {data.history.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-900">{item.id}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="text-gray-900">{item.user.name || item.user.username}</div>
                                        <div className="text-xs text-gray-500">{item.user.email}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="text-gray-900">{item.modelUsed}</div>
                                        <div className="text-xs text-gray-500">Priority: {item.modelPriority}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {item.recognizedText ? (
                                            <div className="space-y-1">
                                                <div className={`text-gray-600 ${expandedQuestions.has(item.id) ? '' : 'truncate max-w-xs'}`}>
                                                    {expandedQuestions.has(item.id) 
                                                        ? item.recognizedText 
                                                        : truncateText(item.recognizedText, 150)}
                                                </div>
                                                {item.recognizedText.length > 150 && (
                                                    <button
                                                        onClick={() => toggleQuestionExpansion(item.id)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                    >
                                                        {expandedQuestions.has(item.id) ? 'Thu gọn' : 'Xem thêm'}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">
                                                {item.success ? 'N/A' : (item.errorMessage || 'Lỗi không xác định')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        {item.success ? (
                                            <span className={`font-medium ${item.confidence >= 80 ? 'text-green-600' :
                                                    item.confidence >= 50 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                }`}>
                                                {item.confidence}%
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">
                                        {item.success ? (
                                            <div>
                                                <div className="text-gray-900">{item.totalTokens}</div>
                                                <div className="text-xs text-gray-500">
                                                    {item.inputTokens} + {item.outputTokens}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                        {item.responseTime}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {item.success ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                ✓ Thành công
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                ✗ Thất bại
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                        <div className="text-sm text-gray-700">
                            Trang {data.pagination.page} / {data.pagination.totalPages}
                            {' '}({data.pagination.total} kết quả)
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                ← Trước
                            </button>
                            <button
                                onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                                disabled={page === data.pagination.totalPages}
                                className="px-3 py-1 bg-white border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                Sau →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
