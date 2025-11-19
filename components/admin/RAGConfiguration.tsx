import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface RAGConfig {
    method: 'qdrant' | 'google-file-search';
    fileSearchStoreName?: string;
}

interface FileSearchStore {
    name: string;
    displayName: string;
    createTime: string;
}

interface RAGStats {
    method: string;
    stores?: number;
    currentStore?: string;
    collections?: number;
    totalPoints?: number;
    collectionDetails?: Array<{ name: string; points: number }>;
}

const RAGConfiguration: React.FC = () => {
    const [config, setConfig] = useState<RAGConfig>({
        method: 'qdrant'
    });
    const [stats, setStats] = useState<RAGStats | null>(null);
    const [stores, setStores] = useState<FileSearchStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creatingStore, setCreatingStore] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchConfig();
        fetchStores();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/rag-config') as { config: RAGConfig; stats: RAGStats };
            setConfig(response.config);
            setStats(response.stats);
        } catch (error: any) {
            console.error('Error fetching RAG config:', error);
            showMessage('error', 'Không thể tải cấu hình RAG');
        } finally {
            setLoading(false);
        }
    };

    const fetchStores = async () => {
        try {
            const response = await api.get('/api/rag-config/file-search-stores') as { stores: FileSearchStore[] };
            setStores(response.stores);
        } catch (error: any) {
            console.error('Error fetching stores:', error);
        }
    };

    const saveConfig = async () => {
        try {
            setSaving(true);

            if (config.method === 'google-file-search' && !config.fileSearchStoreName) {
                showMessage('error', 'Vui lòng chọn File Search store');
                return;
            }

            await api.post('/api/rag-config', config);
            showMessage('success', 'Cấu hình RAG đã được lưu thành công');
            await fetchConfig(); // Refresh stats
        } catch (error: any) {
            console.error('Error saving RAG config:', error);
            showMessage('error', error.message || 'Không thể lưu cấu hình RAG');
        } finally {
            setSaving(false);
        }
    };

    const createStore = async () => {
        if (!newStoreName.trim()) {
            showMessage('error', 'Vui lòng nhập tên store');
            return;
        }

        try {
            setCreatingStore(true);
            await api.post('/api/rag-config/file-search-stores', {
                displayName: newStoreName
            });
            showMessage('success', 'Store đã được tạo thành công');
            setNewStoreName('');
            setShowCreateForm(false);
            await fetchStores();
        } catch (error: any) {
            console.error('Error creating store:', error);
            showMessage('error', error.message || 'Không thể tạo store');
        } finally {
            setCreatingStore(false);
        }
    };

    const deleteStore = async (storeName: string) => {
        if (!confirm(`Bạn có chắc muốn xóa store "${storeName}"?`)) {
            return;
        }

        try {
            await api.delete(`/api/rag-config/file-search-stores/${encodeURIComponent(storeName)}`);
            showMessage('success', 'Store đã được xóa');
            await fetchStores();
            await fetchConfig();
        } catch (error: any) {
            console.error('Error deleting store:', error);
            showMessage('error', error.message || 'Không thể xóa store');
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-semibold text-slate-800">Cấu hình RAG</h3>
                    <p className="text-sm text-slate-600 mt-1">Chọn phương thức RAG: Qdrant hoặc Google File Search</p>
                </div>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                    {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
            </div>

            {message && (
                <div
                    className={`p-4 rounded-lg border ${message.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* RAG Method Selection */}
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div className="border-b border-slate-200 pb-4">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                        <span className="text-2xl mr-3">🔧</span>
                        Phương thức RAG
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                        Chọn giữa hệ thống RAG tự xây dựng (Qdrant) hoặc File Search của Google
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Qdrant Option */}
                    <div
                        onClick={() => setConfig(prev => ({ ...prev, method: 'qdrant' }))}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${config.method === 'qdrant'
                            ? 'border-sky-600 bg-sky-50'
                            : 'border-slate-300 bg-white hover:border-sky-400'
                            }`}
                    >
                        <div className="flex items-start">
                            <input
                                type="radio"
                                checked={config.method === 'qdrant'}
                                onChange={() => setConfig(prev => ({ ...prev, method: 'qdrant' }))}
                                className="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500"
                            />
                            <div className="ml-3 flex-1">
                                <h5 className="font-semibold text-slate-800">Qdrant (Tự xây dựng)</h5>
                                <p className="text-sm text-slate-600 mt-1">
                                    Sử dụng vector database Qdrant với chunking và embedding tùy chỉnh
                                </p>
                                <div className="mt-2 text-sm text-slate-500 space-y-1">
                                    <div>✅ Kiểm soát hoàn toàn chunking strategy</div>
                                    <div>✅ Tùy chỉnh metadata và filtering</div>
                                    <div>✅ Self-hosted, không phụ thuộc dịch vụ bên ngoài</div>
                                    <div>⚠️ Cần quản lý infrastructure riêng</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Google File Search Option */}
                    <div
                        onClick={() => setConfig(prev => ({ ...prev, method: 'google-file-search' }))}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${config.method === 'google-file-search'
                            ? 'border-sky-600 bg-sky-50'
                            : 'border-slate-300 bg-white hover:border-sky-400'
                            }`}
                    >
                        <div className="flex items-start">
                            <input
                                type="radio"
                                checked={config.method === 'google-file-search'}
                                onChange={() => setConfig(prev => ({ ...prev, method: 'google-file-search' }))}
                                className="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500"
                            />
                            <div className="ml-3 flex-1">
                                <h5 className="font-semibold text-slate-800">Google File Search</h5>
                                <p className="text-sm text-slate-600 mt-1">
                                    Sử dụng File Search của Google Gemini API với tự động indexing
                                </p>
                                <div className="mt-2 text-sm text-slate-500 space-y-1">
                                    <div>✅ Tự động chunking và embedding</div>
                                    <div>✅ Không cần quản lý infrastructure</div>
                                    <div>✅ Grounding metadata và citations tự động</div>
                                    <div>⚠️ Phụ thuộc vào Google API</div>
                                    <div>💰 Chi phí embedding ($0.15/1M tokens)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Google File Search Store Selection */}
                {config.method === 'google-file-search' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                            <h5 className="font-medium text-slate-700">Chọn File Search Store</h5>
                            <button
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                className="text-sm px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors"
                            >
                                {showCreateForm ? 'Hủy' : '+ Tạo store mới'}
                            </button>
                        </div>

                        {showCreateForm && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newStoreName}
                                    onChange={(e) => setNewStoreName(e.target.value)}
                                    placeholder="Nhập tên store..."
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                                <button
                                    onClick={createStore}
                                    disabled={creatingStore}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {creatingStore ? 'Đang tạo...' : 'Tạo'}
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {stores.length === 0 ? (
                                <p className="text-sm text-slate-600">Chưa có store nào. Hãy tạo store mới.</p>
                            ) : (
                                stores.map(store => (
                                    <div
                                        key={store.name}
                                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${config.fileSearchStoreName === store.name
                                            ? 'border-sky-600 bg-sky-50'
                                            : 'border-slate-300 hover:border-sky-400'
                                            }`}
                                        onClick={() => setConfig(prev => ({ ...prev, fileSearchStoreName: store.name }))}
                                    >
                                        <div className="flex items-center flex-1">
                                            <input
                                                type="radio"
                                                checked={config.fileSearchStoreName === store.name}
                                                onChange={() => setConfig(prev => ({ ...prev, fileSearchStoreName: store.name }))}
                                                className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                                            />
                                            <div className="ml-3">
                                                <p className="font-medium text-slate-800">{store.displayName}</p>
                                                <p className="text-xs text-slate-500">{store.name}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteStore(store.name);
                                            }}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Current Stats */}
            {stats && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h4 className="text-lg font-semibold text-slate-800 mb-4">
                        📊 Thống kê hiện tại
                    </h4>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Phương thức:</span>
                            <span className="font-medium">
                                {stats.method === 'qdrant' ? 'Qdrant' : 'Google File Search'}
                            </span>
                        </div>

                        {stats.method === 'google-file-search' && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Store đang dùng:</span>
                                    <span className="font-medium">{stats.currentStore || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Tổng stores:</span>
                                    <span className="font-medium">{stats.stores || 0}</span>
                                </div>
                            </>
                        )}

                        {stats.method === 'qdrant' && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Collections:</span>
                                    <span className="font-medium">{stats.collections || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Tổng vectors:</span>
                                    <span className="font-medium">{stats.totalPoints?.toLocaleString() || 0}</span>
                                </div>
                                {stats.collectionDetails && stats.collectionDetails.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <p className="text-sm font-medium text-slate-700 mb-2">Chi tiết collections:</p>
                                        <div className="space-y-1">
                                            {stats.collectionDetails.map(col => (
                                                <div key={col.name} className="flex justify-between text-sm">
                                                    <span className="text-slate-600">{col.name}:</span>
                                                    <span className="font-medium">{col.points.toLocaleString()} vectors</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Documentation */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h5 className="font-semibold text-amber-800 mb-2">📚 Tài liệu tham khảo</h5>
                <ul className="text-sm text-amber-700 space-y-1">
                    <li>• <a href="https://ai.google.dev/gemini-api/docs/file-search" target="_blank" rel="noopener noreferrer" className="underline">Google File Search Documentation</a></li>
                    <li>• <a href="https://qdrant.tech/documentation/" target="_blank" rel="noopener noreferrer" className="underline">Qdrant Documentation</a></li>
                    <li>• Để upload tài liệu vào File Search, vào trang quản lý tài liệu</li>
                </ul>
            </div>
        </div>
    );
};

export default RAGConfiguration;
