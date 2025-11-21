import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface Summary {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: string;
    totalTokens: number;
    totalCost: number;
    avgDuration: number;
    avgTokensPerCall: number;
    avgCostPerCall: number;
}

interface ModelStat {
    calls: number;
    tokens: number;
    cost: number;
    avgDuration: number;
    success: number;
    failed: number;
}

interface RequestTypeStat {
    calls: number;
    tokens: number;
    cost: number;
    avgDuration: number;
}

interface TimeSeriesData {
    date: string;
    calls: number;
    tokens: number;
    cost: number;
}

interface ApiCall {
    id: string;
    startTime: string;
    modelName: string;
    requestType: string;
    duration: number;
    totalTokens: number;
    totalCost: number;
    status: string;
    errorMessage?: string;
}

interface UserStat {
    userId: string;
    name: string;
    username: string;
    email: string;
    role: string;
    callCount: number;
    totalTokens: number;
    totalCost: number;
}

interface SessionDetail {
    sessionId: string;
    user: {
        id: string;
        name: string;
        username: string;
        role: string;
    } | null;
    requestType: string;
    callCount: number;
    totalTokens: number;
    totalCost: number;
    totalDuration: number;
    startTime: string;
    endTime: string | null;
    calls: {
        id: string;
        endpoint: string;
        modelName: string;
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
        duration: number;
        status: string;
        startTime: string;
    }[];
}

interface GeminiMonitoringProps {
    onBack: () => void;
}

const GeminiMonitoring: React.FC<GeminiMonitoringProps> = ({ onBack }) => {
    const [summary, setSummary] = useState<{ today: Summary; thisMonth: Summary; last7Days: Summary } | null>(null);
    const [timeRange, setTimeRange] = useState<'today' | 'last7Days' | 'thisMonth'>('last7Days');
    const [models, setModels] = useState<Record<string, ModelStat>>({});
    const [requestTypes, setRequestTypes] = useState<Record<string, RequestTypeStat>>({});
    const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
    const [recentCalls, setRecentCalls] = useState<ApiCall[]>([]);
    const [users, setUsers] = useState<UserStat[]>([]);
    const [sessions, setSessions] = useState<SessionDetail[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'requests' | 'timeline' | 'calls' | 'users' | 'sessions'>('overview');

    const loadSummary = async () => {
        try {
            console.log('[GeminiMonitoring] Loading summary...');
            const response: any = await api.get('/api/gemini/summary');
            console.log('[GeminiMonitoring] Summary response:', response);
            if (response.success) {
                setSummary(response.data);
            }
        } catch (err: any) {
            console.error('[GeminiMonitoring] Failed to load summary:', err);
            setError(err.message);
        }
    };

    const loadStats = async (days: number = 7) => {
        try {
            setLoading(true);
            setError(null);
            console.log('[GeminiMonitoring] Loading stats for', days, 'days...');

            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            const endDate = new Date().toISOString();

            const response: any = await api.get(`/api/gemini/stats?startDate=${startDate}&endDate=${endDate}`);

            console.log('[GeminiMonitoring] Stats response:', response);

            if (response.success) {
                const { byModel, byRequestType, timeSeries, recentCalls } = response.data;
                console.log('[GeminiMonitoring] Data received:', {
                    models: Object.keys(byModel || {}).length,
                    requestTypes: Object.keys(byRequestType || {}).length,
                    timeSeries: (timeSeries || []).length,
                    recentCalls: (recentCalls || []).length,
                });
                setModels(byModel || {});
                setRequestTypes(byRequestType || {});
                setTimeSeries(timeSeries || []);
                setRecentCalls(recentCalls || []);
            }
        } catch (err: any) {
            console.error('[GeminiMonitoring] Failed to load stats:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async (days: number = 30) => {
        try {
            setLoading(true);
            const response: any = await api.get(`/api/gemini/users?days=${days}`);
            if (response.success) {
                setUsers(response.data || []);
            }
        } catch (err: any) {
            console.error('[GeminiMonitoring] Failed to load users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadSessions = async (days: number = 7, userId?: string) => {
        try {
            setLoading(true);
            const userParam = userId ? `&userId=${userId}` : '';
            const response: any = await api.get(`/api/gemini/sessions?days=${days}${userParam}`);
            if (response.success) {
                setSessions(response.data || []);
            }
        } catch (err: any) {
            console.error('[GeminiMonitoring] Failed to load sessions:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
        loadStats(timeRange === 'today' ? 1 : timeRange === 'last7Days' ? 7 : 30);
        if (activeTab === 'users') {
            loadUsers(30);
        } else if (activeTab === 'sessions') {
            // Load users for filter dropdown and sessions
            if (users.length === 0) {
                loadUsers(30);
            }
            loadSessions(7, selectedUserId || undefined);
        }
    }, [timeRange, activeTab, selectedUserId]);

    const formatCost = (cost: number) => {
        return `$${cost.toFixed(6)}`;
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const currentSummary = summary ? (
        timeRange === 'today' ? summary.today :
            timeRange === 'last7Days' ? summary.last7Days :
                summary.thisMonth
    ) : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Gemini API Monitoring</h1>
                                <p className="text-slate-600 text-sm">Track usage, costs, and performance</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as any)}
                                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="today">Hôm nay</option>
                                <option value="last7Days">7 ngày qua</option>
                                <option value="thisMonth">Tháng này</option>
                            </select>
                            <button
                                onClick={() => {
                                    loadSummary();
                                    loadStats(timeRange === 'today' ? 1 : timeRange === 'last7Days' ? 7 : 30);
                                }}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
                    <div className="flex border-b border-slate-200 overflow-x-auto">
                        {[
                            { id: 'overview', label: '📊 Tổng quan', icon: '📊' },
                            { id: 'models', label: '🤖 Models', icon: '🤖' },
                            { id: 'requests', label: '📋 Request Types', icon: '📋' },
                            { id: 'users', label: '👥 Users', icon: '👥' },
                            { id: 'sessions', label: '🔗 Sessions', icon: '🔗' },
                            { id: 'timeline', label: '📈 Timeline', icon: '📈' },
                            { id: 'calls', label: '📞 Recent Calls', icon: '📞' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && currentSummary && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-600 text-sm">Total Calls</span>
                                    <span className="text-2xl">📞</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-800">{formatNumber(currentSummary.totalCalls)}</div>
                                <div className="text-sm text-green-600 mt-1">
                                    {currentSummary.successRate} success rate
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-600 text-sm">Total Tokens</span>
                                    <span className="text-2xl">🔢</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-800">{formatNumber(currentSummary.totalTokens)}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                    {formatNumber(currentSummary.avgTokensPerCall)} avg/call
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-600 text-sm">Total Cost</span>
                                    <span className="text-2xl">💰</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-800">{formatCost(currentSummary.totalCost)}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                    {formatCost(currentSummary.avgCostPerCall)} avg/call
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-slate-600 text-sm">Avg Duration</span>
                                    <span className="text-2xl">⏱️</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-800">{formatDuration(currentSummary.avgDuration)}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                    {formatNumber(currentSummary.successfulCalls)} successful
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Models Tab */}
                {activeTab === 'models' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Model</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Calls</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Tokens</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Cost</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Avg Duration</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Success Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {Object.entries(models)
                                    .sort((a, b) => (b[1] as ModelStat).cost - (a[1] as ModelStat).cost)
                                    .map(([name, statData]) => {
                                        const stat = statData as ModelStat;
                                        return (
                                            <tr key={name} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-800">{name}</td>
                                                <td className="px-6 py-4 text-center">{formatNumber(stat.calls)}</td>
                                                <td className="px-6 py-4 text-center">{formatNumber(stat.tokens)}</td>
                                                <td className="px-6 py-4 text-center font-mono">{formatCost(stat.cost)}</td>
                                                <td className="px-6 py-4 text-center">{formatDuration(stat.avgDuration)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${stat.success / stat.calls >= 0.95 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {((stat.success / stat.calls) * 100).toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Request Types Tab */}
                {activeTab === 'requests' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Calls</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Tokens</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Cost</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Avg Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {Object.entries(requestTypes)
                                    .sort((a, b) => (b[1] as RequestTypeStat).calls - (a[1] as RequestTypeStat).calls)
                                    .map(([type, statData]) => {
                                        const stat = statData as RequestTypeStat;
                                        return (
                                            <tr key={type} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-medium text-slate-800">{type}</td>
                                                <td className="px-6 py-4 text-center">{formatNumber(stat.calls)}</td>
                                                <td className="px-6 py-4 text-center">{formatNumber(stat.tokens)}</td>
                                                <td className="px-6 py-4 text-center font-mono">{formatCost(stat.cost)}</td>
                                                <td className="px-6 py-4 text-center">{formatDuration(stat.avgDuration)}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Daily Statistics</h3>
                        <div className="space-y-4">
                            {timeSeries.map((data) => (
                                <div key={data.date} className="flex items-center gap-4">
                                    <div className="w-24 text-sm text-slate-600">{data.date}</div>
                                    <div className="flex-1 grid grid-cols-3 gap-4">
                                        <div>
                                            <div className="text-xs text-slate-500">Calls</div>
                                            <div className="font-semibold">{formatNumber(data.calls)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Tokens</div>
                                            <div className="font-semibold">{formatNumber(data.tokens)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Cost</div>
                                            <div className="font-semibold font-mono">{formatCost(data.cost)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Calls Tab */}
                {activeTab === 'calls' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Model</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Duration</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Tokens</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Cost</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {recentCalls.slice(0, 50).map((call) => (
                                    <tr key={call.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(call.startTime).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">{call.modelName}</td>
                                        <td className="px-6 py-4 text-sm">{call.requestType}</td>
                                        <td className="px-6 py-4 text-center text-sm">{formatDuration(call.duration)}</td>
                                        <td className="px-6 py-4 text-center text-sm">{formatNumber(call.totalTokens)}</td>
                                        <td className="px-6 py-4 text-center text-sm font-mono">{formatCost(call.totalCost)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${call.status === 'success'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                                }`}>
                                                {call.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">👥 Users API Usage (Last 30 Days)</h3>
                        </div>
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Role</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">API Calls</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Tokens</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Cost</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {users.map((user) => (
                                    <tr key={user.userId} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{user.name}</div>
                                            <div className="text-xs text-slate-500">@{user.username}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-800'
                                                : 'bg-slate-100 text-slate-800'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-semibold">{formatNumber(user.callCount)}</td>
                                        <td className="px-6 py-4 text-center">{formatNumber(user.totalTokens)}</td>
                                        <td className="px-6 py-4 text-center font-mono">{formatCost(user.totalCost)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => {
                                                    setSelectedUserId(user.userId);
                                                    setActiveTab('sessions');
                                                }}
                                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                                            >
                                                View Sessions
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Sessions Tab */}
                {activeTab === 'sessions' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800">🔗 User Request Sessions</h3>
                            <div className="flex items-center gap-4">
                                {selectedUserId && (
                                    <button
                                        onClick={() => setSelectedUserId(null)}
                                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded transition-colors"
                                    >
                                        Clear Filter
                                    </button>
                                )}
                                <select
                                    value={selectedUserId || ''}
                                    onChange={(e) => setSelectedUserId(e.target.value || null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">All Users</option>
                                    {users.map((user) => (
                                        <option key={user.userId} value={user.userId}>
                                            {user.name} (@{user.username})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-200">
                            {sessions.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <div className="text-4xl mb-4">🔍</div>
                                    <p className="text-lg font-medium mb-2">Chưa có session nào</p>
                                    <p className="text-sm">
                                        {selectedUserId
                                            ? 'User này chưa có API calls với sessionId. Thử clear filter hoặc thực hiện chat mới.'
                                            : 'Chưa có API calls với sessionId. Thực hiện chat hoặc camera search để tạo sessions.'}
                                    </p>
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <div key={session.sessionId} className="p-6 hover:bg-slate-50">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="font-semibold text-slate-800">
                                                        {session.user ? `${session.user.name} (@${session.user.username})` : 'Anonymous'}
                                                    </h4>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${session.user?.role === 'admin'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-slate-100 text-slate-800'
                                                        }`}>
                                                        {session.user?.role || 'N/A'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        {session.requestType}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Session ID: {session.sessionId}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {new Date(session.startTime).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-slate-800">{session.callCount}</div>
                                                <div className="text-xs text-slate-500">API Calls</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="bg-slate-50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500">Total Tokens</div>
                                                <div className="text-lg font-semibold text-slate-800">{formatNumber(session.totalTokens)}</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500">Total Cost</div>
                                                <div className="text-lg font-semibold text-slate-800 font-mono">{formatCost(session.totalCost)}</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-3">
                                                <div className="text-xs text-slate-500">Duration</div>
                                                <div className="text-lg font-semibold text-slate-800">{formatDuration(session.totalDuration)}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setExpandedSession(expandedSession === session.sessionId ? null : session.sessionId)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            {expandedSession === session.sessionId ? '▼ Hide Details' : '▶ Show API Calls'}
                                        </button>
                                        {expandedSession === session.sessionId && (
                                            <div className="mt-4 border-t border-slate-200 pt-4">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Time</th>
                                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Endpoint</th>
                                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Model</th>
                                                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Tokens</th>
                                                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Cost</th>
                                                            <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200">
                                                        {session.calls.map((call, idx) => (
                                                            <tr key={call.id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-2 text-xs text-slate-600">
                                                                    {new Date(call.startTime).toLocaleTimeString()}
                                                                </td>
                                                                <td className="px-4 py-2 text-xs">{call.endpoint}</td>
                                                                <td className="px-4 py-2 text-xs font-medium">{call.modelName}</td>
                                                                <td className="px-4 py-2 text-center text-xs">
                                                                    <div>{call.inputTokens} in</div>
                                                                    <div>{call.outputTokens} out</div>
                                                                </td>
                                                                <td className="px-4 py-2 text-center text-xs font-mono">{formatCost(call.totalCost)}</td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${call.status === 'success'
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                        }`}>
                                                                        {call.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeminiMonitoring;
