import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface ModelStat {
    name: string;
    priority: number;
    rpm: string;
    rpd: string;
    rpmPercent: string;
    rpdPercent: string;
    available: boolean;
}

interface ModelUsageStatsProps {
    onBack: () => void;
}

const ModelUsageStats: React.FC<ModelUsageStatsProps> = ({ onBack }) => {
    const [stats, setStats] = useState<ModelStat[]>([]);
    const [totalModels, setTotalModels] = useState(0);
    const [availableModels, setAvailableModels] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null); // Clear previous errors

            console.log('[ModelUsageStats] Fetching from /api/admin/model-usage');
            const response = await fetch('/api/admin/model-usage', {
                credentials: 'include'
            });

            console.log('[ModelUsageStats] Response status:', response.status);
            console.log('[ModelUsageStats] Response headers:', response.headers.get('content-type'));

            // Check content type first
            const contentType = response.headers.get('content-type');

            if (!response.ok) {
                // Handle error responses
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch model usage stats');
                } else {
                    // HTML response (likely 401/403/404)
                    const htmlText = await response.text();
                    console.error('[ModelUsageStats] HTML Response:', htmlText.substring(0, 200));

                    if (response.status === 401) {
                        throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập lại với tài khoản Admin.');
                    } else if (response.status === 403) {
                        throw new Error('Bạn không có quyền truy cập. Chỉ Admin mới có thể xem thống kê này.');
                    } else if (response.status === 404) {
                        throw new Error('API endpoint không tồn tại. Vui lòng kiểm tra server đã chạy chưa.');
                    } else {
                        throw new Error(`HTTP ${response.status}: Không thể tải thống kê model`);
                    }
                }
            }

            // Success response - but check if it's actually JSON
            if (!contentType || !contentType.includes('application/json')) {
                const htmlText = await response.text();
                console.error('[ModelUsageStats] Expected JSON but got:', contentType);
                console.error('[ModelUsageStats] Response preview:', htmlText.substring(0, 200));
                throw new Error('Server trả về định dạng không đúng (HTML thay vì JSON). Có thể bạn chưa đăng nhập hoặc server có vấn đề.');
            }

            const data = await response.json();
            console.log('[ModelUsageStats] Data received:', data);

            setStats(data.stats || []);
            setTotalModels(data.totalModels || 0);
            setAvailableModels(data.availableModels || 0);
            setError(null);
        } catch (err: any) {
            console.error('[ModelUsageStats] Error loading stats:', err);
            setError(err.message || 'Không thể tải thống kê model');
        } finally {
            setLoading(false);
        }
    };

    const handleResetModel = async (modelName?: string) => {
        try {
            const response = await fetch('/api/admin/reset-model-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ modelName })
            });

            if (!response.ok) {
                // Check if response is JSON or HTML
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to reset model usage');
                } else {
                    if (response.status === 401) {
                        throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập lại.');
                    } else if (response.status === 403) {
                        throw new Error('Bạn không có quyền thực hiện thao tác này.');
                    } else {
                        throw new Error(`HTTP ${response.status}: Không thể reset model`);
                    }
                }
            }

            // Reload stats
            await loadStats();
        } catch (err: any) {
            console.error('Error resetting model:', err);
            setError(err.message);
        }
    };

    useEffect(() => {
        loadStats();
        // Auto-refresh every 10 seconds
        const interval = setInterval(loadStats, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                aria-label="Go back to admin dashboard"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Gemini Model Usage Stats</h1>
                                <p className="text-slate-600 text-sm">
                                    {availableModels}/{totalModels} models available
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadStats()}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                aria-label="Refresh model usage statistics"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                Refresh
                            </button>
                            <button
                                onClick={() => handleResetModel()}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            >
                                Reset All
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800 mb-2">{error}</p>
                        <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-red-600 hover:text-red-700">
                                💡 Hướng dẫn khắc phục
                            </summary>
                            <div className="mt-2 text-sm text-red-700 space-y-1">
                                <p><strong>1. Kiểm tra đăng nhập:</strong></p>
                                <ul className="list-disc list-inside ml-4">
                                    <li>Mở Console (F12) và kiểm tra user hiện tại</li>
                                    <li>Kiểm tra user có role = admin không</li>
                                </ul>
                                <p className="mt-2"><strong>2. Kiểm tra server:</strong></p>
                                <ul className="list-disc list-inside ml-4">
                                    <li>Server có đang chạy không? (port 3000)</li>
                                    <li>Xem logs trong terminal server</li>
                                </ul>
                                <p className="mt-2"><strong>3. Nếu vẫn lỗi:</strong></p>
                                <ul className="list-disc list-inside ml-4">
                                    <li>Đăng xuất và đăng nhập lại</li>
                                    <li>Xóa cookies và refresh page</li>
                                    <li>Restart server</li>
                                </ul>
                            </div>
                        </details>
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading stats...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Priority
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Model Name
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            RPM Usage
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            RPD Usage
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {stats.map((stat, index) => (
                                        <tr
                                            key={stat.name}
                                            className={`hover:bg-slate-50 transition-colors ${!stat.available ? 'bg-red-50' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                                }`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                                                    {stat.priority}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-800">{stat.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="font-mono text-sm text-slate-700">{stat.rpm}</span>
                                                    <div className="w-full max-w-[100px] bg-slate-200 rounded-full h-2 overflow-hidden">
                                                        {/* eslint-disable-next-line react/forbid-dom-props */}
                                                        <div
                                                            className={`h-full transition-all ${parseFloat(stat.rpmPercent) >= 100
                                                                ? 'bg-red-500 w-full'
                                                                : parseFloat(stat.rpmPercent) >= 75
                                                                    ? 'bg-yellow-500'
                                                                    : 'bg-green-500'
                                                                }`}
                                                            style={parseFloat(stat.rpmPercent) < 100 ? { width: stat.rpmPercent } : undefined}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-500">{stat.rpmPercent}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="font-mono text-sm text-slate-700">{stat.rpd}</span>
                                                    <div className="w-full max-w-[100px] bg-slate-200 rounded-full h-2 overflow-hidden">
                                                        {/* eslint-disable-next-line react/forbid-dom-props */}
                                                        <div
                                                            className={`h-full transition-all ${parseFloat(stat.rpdPercent) >= 100
                                                                ? 'bg-red-500 w-full'
                                                                : parseFloat(stat.rpdPercent) >= 75
                                                                    ? 'bg-yellow-500'
                                                                    : 'bg-green-500'
                                                                }`}
                                                            style={parseFloat(stat.rpdPercent) < 100 ? { width: stat.rpdPercent } : undefined}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-500">{stat.rpdPercent}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {stat.available ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        ✓ Available
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        ✗ Exhausted
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleResetModel(stat.name)}
                                                    className="text-xs px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors"
                                                >
                                                    Reset
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">📊 How Model Rotation Works</h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li><strong>Priority:</strong> Lower number = higher priority. System uses models in priority order.</li>
                        <li><strong>RPM (Requests Per Minute):</strong> Number of requests allowed per minute.</li>
                        <li><strong>RPD (Requests Per Day):</strong> Total daily request limit.</li>
                        <li><strong>Auto-Rotation:</strong> When a model reaches its limit, system automatically switches to the next available model.</li>
                        <li><strong>Auto-Reset:</strong> Counters reset automatically every minute (RPM) and daily (RPD).</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ModelUsageStats;
