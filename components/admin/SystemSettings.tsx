import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface SystemSettingsData {
    id?: string;
    modelRotationEnabled: boolean;
    defaultModel: string;
    peakHoursEnabled: boolean;
    peakHoursStart: string;
    peakHoursEnd: string;
    peakHoursDays: number[];
    updatedAt?: string;
    updatedBy?: string;
}

const AVAILABLE_MODELS = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-2.5-pro'
];

const DAYS_OF_WEEK = [
    { value: 0, label: 'Chủ nhật' },
    { value: 1, label: 'Thứ 2' },
    { value: 2, label: 'Thứ 3' },
    { value: 3, label: 'Thứ 4' },
    { value: 4, label: 'Thứ 5' },
    { value: 5, label: 'Thứ 6' },
    { value: 6, label: 'Thứ 7' }
];

const SystemSettings: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettingsData>({
        modelRotationEnabled: true,
        defaultModel: 'gemini-2.5-flash',
        peakHoursEnabled: false,
        peakHoursStart: '18:00',
        peakHoursEnd: '22:00',
        peakHoursDays: [1, 2, 3, 4, 5] // Monday to Friday
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
            const data = await api.get('/api/admin/system-settings') as SystemSettingsData;
            setSettings(data);
        } catch (error: any) {
            console.error('Error fetching system settings:', error);
            showMessage('error', 'Không thể tải cài đặt hệ thống');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            await api.put('/api/admin/system-settings', settings);
            showMessage('success', 'Cài đặt đã được lưu thành công');
            await fetchSettings(); // Refresh to get updated timestamp
        } catch (error: any) {
            console.error('Error saving system settings:', error);
            showMessage('error', 'Không thể lưu cài đặt');
        } finally {
            setSaving(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const toggleDay = (dayValue: number) => {
        setSettings(prev => {
            const days = [...prev.peakHoursDays];
            const index = days.indexOf(dayValue);

            if (index > -1) {
                days.splice(index, 1);
            } else {
                days.push(dayValue);
                days.sort((a, b) => a - b);
            }

            return { ...prev, peakHoursDays: days };
        });
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
                    <h3 className="text-xl font-semibold text-slate-800">Cài đặt hệ thống</h3>
                    <p className="text-sm text-slate-600 mt-1">Quản lý quay vòng model AI và giờ cao điểm</p>
                </div>
                <button
                    onClick={saveSettings}
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

            {/* Model Rotation Settings */}
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div className="border-b border-slate-200 pb-4">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                        <span className="text-2xl mr-3">🤖</span>
                        Quay vòng Model AI
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                        Tự động chuyển đổi giữa các model AI để tối ưu quota miễn phí
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                            <label className="font-medium text-slate-700">Bật quay vòng model</label>
                            <p className="text-sm text-slate-600 mt-1">
                                {settings.modelRotationEnabled
                                    ? '🔄 Free Tier Mode: Tự động chuyển đổi giữa 10 models để tối ưu quota'
                                    : '💰 Paid Tier Mode: Sử dụng 1 model đã nâng cấp (không giới hạn quota)'}
                            </p>
                        </div>
                        <button
                            onClick={() => setSettings(prev => ({ ...prev, modelRotationEnabled: !prev.modelRotationEnabled }))}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${settings.modelRotationEnabled ? 'bg-sky-600' : 'bg-slate-300'
                                }`}
                            title={settings.modelRotationEnabled ? 'Tắt quay vòng (chuyển sang Paid Mode)' : 'Bật quay vòng (chuyển sang Free Mode)'}
                            aria-label={settings.modelRotationEnabled ? 'Tắt quay vòng model' : 'Bật quay vòng model'}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.modelRotationEnabled ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Default Model Selection */}
                    {!settings.modelRotationEnabled && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                            <label htmlFor="default-model" className="block font-medium text-slate-700">
                                🎯 Model mặc định (Paid/Upgraded Tier)
                            </label>
                            <select
                                id="default-model"
                                value={settings.defaultModel}
                                onChange={(e) => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                title="Chọn model mặc định"
                            >
                                {AVAILABLE_MODELS.map(model => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </select>
                            <div className="text-sm text-blue-700 space-y-2">
                                <p>💡 <strong>Model này sẽ được sử dụng cho tất cả các tìm kiếm AI</strong></p>
                                <p>⚡ <strong>Lưu ý:</strong> Khi tắt quay vòng, hệ thống giả định bạn đã nâng cấp model này lên <strong>Paid Tier</strong> với giới hạn cao hơn (VD: 1000+ RPM)</p>
                                <p>📊 Hệ thống sẽ <strong>KHÔNG</strong> tracking RPM/RPD quota cho model này</p>
                            </div>
                        </div>
                    )}

                    {/* Info about rotation */}
                    {settings.modelRotationEnabled && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                            <p className="text-sm text-green-800 font-semibold">
                                ✅ Quay vòng model đang được bật (Free Tier Mode)
                            </p>
                            <p className="text-sm text-green-700">
                                🔄 Hệ thống sẽ tự động chọn model tối ưu từ 10 models dựa trên quota còn lại (RPM/RPD)
                            </p>
                            <p className="text-sm text-green-700">
                                📊 Tất cả requests sẽ được tracking để tránh vượt quá giới hạn của Google Free Tier
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Peak Hours Settings */}
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div className="border-b border-slate-200 pb-4">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                        <span className="text-2xl mr-3">⏰</span>
                        Giờ cao điểm
                    </h4>
                    <p className="text-sm text-slate-600 mt-2">
                        Khóa tính năng Premium cho người dùng thường trong giờ cao điểm
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                            <label className="font-medium text-slate-700">Bật giờ cao điểm</label>
                            <p className="text-sm text-slate-600 mt-1">
                                {settings.peakHoursEnabled
                                    ? 'Chỉ user Premium mới sử dụng được tính năng AI trong giờ cao điểm'
                                    : 'Tất cả người dùng có thể sử dụng tính năng AI mọi lúc'}
                            </p>
                        </div>
                        <button
                            onClick={() => setSettings(prev => ({ ...prev, peakHoursEnabled: !prev.peakHoursEnabled }))}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${settings.peakHoursEnabled ? 'bg-sky-600' : 'bg-slate-300'
                                }`}
                            title={settings.peakHoursEnabled ? 'Tắt giờ cao điểm' : 'Bật giờ cao điểm'}
                            aria-label={settings.peakHoursEnabled ? 'Tắt giờ cao điểm' : 'Bật giờ cao điểm'}
                        >
                            <span
                                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.peakHoursEnabled ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Time Range Configuration */}
                    {settings.peakHoursEnabled && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="peak-start" className="block font-medium text-slate-700 mb-2">
                                        Giờ bắt đầu
                                    </label>
                                    <input
                                        id="peak-start"
                                        type="time"
                                        value={settings.peakHoursStart}
                                        onChange={(e) => setSettings(prev => ({ ...prev, peakHoursStart: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                        title="Chọn giờ bắt đầu"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="peak-end" className="block font-medium text-slate-700 mb-2">
                                        Giờ kết thúc
                                    </label>
                                    <input
                                        id="peak-end"
                                        type="time"
                                        value={settings.peakHoursEnd}
                                        onChange={(e) => setSettings(prev => ({ ...prev, peakHoursEnd: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                        title="Chọn giờ kết thúc"
                                    />
                                </div>
                            </div>

                            {/* Days Selection */}
                            <div>
                                <label className="block font-medium text-slate-700 mb-3">
                                    Ngày áp dụng
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                                    {DAYS_OF_WEEK.map(day => (
                                        <button
                                            key={day.value}
                                            onClick={() => toggleDay(day.value)}
                                            className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${settings.peakHoursDays.includes(day.value)
                                                ? 'bg-sky-600 border-sky-600 text-white'
                                                : 'bg-white border-slate-300 text-slate-700 hover:border-sky-400'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">
                                    <strong>📌 Cài đặt hiện tại:</strong> Giờ cao điểm từ <strong>{settings.peakHoursStart}</strong> đến{' '}
                                    <strong>{settings.peakHoursEnd}</strong> vào{' '}
                                    {settings.peakHoursDays.length === 0 ? (
                                        <strong>không ngày nào</strong>
                                    ) : settings.peakHoursDays.length === 7 ? (
                                        <strong>tất cả các ngày</strong>
                                    ) : (
                                        <>
                                            <strong>
                                                {settings.peakHoursDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ')}
                                            </strong>
                                        </>
                                    )}
                                </p>
                            </div>

                            {/* Impact Warning */}
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">
                                    ⚠️ <strong>Lưu ý:</strong> Trong giờ cao điểm, người dùng thường sẽ không thể sử dụng tính năng{' '}
                                    <strong>AI Trợ lý</strong> và <strong>Tra cứu nhanh</strong>. Chỉ người dùng Premium mới có quyền truy cập.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Last Updated Info */}
            {settings.updatedAt && (
                <div className="text-sm text-slate-500 text-center">
                    Cập nhật lần cuối: {new Date(settings.updatedAt).toLocaleString('vi-VN')}
                </div>
            )}
        </div>
    );
};

export default SystemSettings;
