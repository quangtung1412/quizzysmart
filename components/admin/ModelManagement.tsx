import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface ModelSettings {
    id?: string;
    defaultModel: string;
    cheaperModel: string;
    embeddingModel: string;
    updatedAt?: string;
    updatedBy?: string;
}

const AVAILABLE_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-2.5-pro'
];

const EMBEDDING_MODELS = [
    'gemini-embedding-001',
    'text-embedding-004'
];

const ModelManagement: React.FC = () => {
    const [settings, setSettings] = useState<ModelSettings>({
        defaultModel: 'gemini-2.5-flash',
        cheaperModel: 'gemini-2.0-flash-lite',
        embeddingModel: 'gemini-embedding-001'
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const data = await api.get('/api/admin/model-settings') as ModelSettings;
            setSettings(data);
        } catch (error: any) {
            console.error('Error fetching model settings:', error);
            showMessage('error', 'Không thể tải cài đặt model');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            await api.put('/api/admin/model-settings', settings);
            showMessage('success', 'Cài đặt model đã được lưu thành công');
            await fetchSettings(); // Refresh to get updated timestamp
        } catch (error: any) {
            console.error('Error saving model settings:', error);
            showMessage('error', 'Không thể lưu cài đặt model');
        } finally {
            setSaving(false);
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
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                {/* Header */}
                <div className="border-b border-slate-200 p-6">
                    <h2 className="text-2xl font-bold text-slate-800">Quản lý AI Models</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Cấu hình các model AI được sử dụng trong ứng dụng
                    </p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mx-6 mt-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        <div className="flex items-center">
                            <span className="text-lg mr-2">{message.type === 'success' ? '✅' : '❌'}</span>
                            <span>{message.text}</span>
                        </div>
                    </div>
                )}

                {/* Settings Form */}
                <div className="p-6 space-y-6">
                    {/* Default Model */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">
                            🤖 Model mặc định
                        </label>
                        <p className="text-sm text-slate-600">
                            Model được sử dụng cho các câu hỏi thông thường (mặc định: gemini-2.5-flash)
                        </p>
                        <select
                            value={settings.defaultModel}
                            onChange={(e) => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        >
                            {AVAILABLE_MODELS.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    {/* Cheaper Model */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">
                            💰 Model tiết kiệm
                        </label>
                        <p className="text-sm text-slate-600">
                            Model nhẹ và nhanh hơn để tiết kiệm quota (mặc định: gemini-2.0-flash-lite)
                        </p>
                        <select
                            value={settings.cheaperModel}
                            onChange={(e) => setSettings(prev => ({ ...prev, cheaperModel: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        >
                            {AVAILABLE_MODELS.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    {/* Embedding Model */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">
                            🔤 Embedding Model
                        </label>
                        <p className="text-sm text-slate-600">
                            Model dùng cho việc tạo embeddings trong RAG (mặc định: gemini-embedding-001)
                        </p>
                        <select
                            value={settings.embeddingModel}
                            onChange={(e) => setSettings(prev => ({ ...prev, embeddingModel: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        >
                            {EMBEDDING_MODELS.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    {/* Model Descriptions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <h3 className="font-semibold text-blue-900 flex items-center">
                            <span className="mr-2">ℹ️</span>
                            Thông tin về các models
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
                            <li><strong>gemini-2.5-flash</strong>: Model mới nhất, cân bằng giữa tốc độ và chất lượng</li>
                            <li><strong>gemini-2.0-flash</strong>: Model ổn định, tốc độ cao</li>
                            <li><strong>gemini-2.0-flash-lite</strong>: Model nhẹ, tiết kiệm quota, phù hợp cho câu hỏi đơn giản</li>
                            <li><strong>gemini-2.5-flash-lite</strong>: Phiên bản lite của 2.5-flash</li>
                            <li><strong>gemini-embedding-001</strong>: Model embedding tiêu chuẩn cho RAG</li>
                        </ul>
                    </div>

                    {/* Last Update Info */}
                    {settings.updatedAt && (
                        <div className="text-sm text-slate-600">
                            <p>
                                <strong>Cập nhật lần cuối:</strong>{' '}
                                {new Date(settings.updatedAt).toLocaleString('vi-VN')}
                                {settings.updatedBy && ` bởi ${settings.updatedBy}`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer with Save Button */}
                <div className="border-t border-slate-200 p-6 bg-slate-50 flex justify-end">
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {saving ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Đang lưu...
                            </span>
                        ) : (
                            'Lưu cài đặt'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModelManagement;
