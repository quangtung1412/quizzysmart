import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface SubscriptionPlan {
    id: string;
    planId: string;
    name: string;
    price: number;
    aiQuota: number;
    duration: number;
    features: string[];
    isActive: boolean;
    displayOrder: number;
    popular: boolean;
    bestChoice: boolean;
    createdAt: string;
    updatedAt: string;
}

const SubscriptionPlanManagement: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        planId: '',
        name: '',
        price: 0,
        aiQuota: 0,
        duration: 0,
        features: [''],
        isActive: true,
        displayOrder: 0,
        popular: false,
        bestChoice: false
    });

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const data = await api.adminGetSubscriptionPlans();
            setPlans(data);
        } catch (error) {
            console.error('Failed to load subscription plans:', error);
            showMessage('error', 'Không thể tải danh sách gói');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleEdit = (plan: SubscriptionPlan) => {
        setEditingPlan(plan);
        setFormData({
            planId: plan.planId,
            name: plan.name,
            price: plan.price,
            aiQuota: plan.aiQuota,
            duration: plan.duration,
            features: plan.features,
            isActive: plan.isActive,
            displayOrder: plan.displayOrder,
            popular: plan.popular,
            bestChoice: plan.bestChoice
        });
        setShowForm(true);
    };

    const handleCreate = () => {
        setEditingPlan(null);
        setFormData({
            planId: '',
            name: '',
            price: 0,
            aiQuota: 0,
            duration: 0,
            features: [''],
            isActive: true,
            displayOrder: 0,
            popular: false,
            bestChoice: false
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload = {
                ...formData,
                features: formData.features.filter(f => f.trim() !== '')
            };

            if (editingPlan) {
                await api.adminUpdateSubscriptionPlan(editingPlan.id, payload);
                showMessage('success', 'Cập nhật gói thành công');
            } else {
                await api.adminCreateSubscriptionPlan(payload);
                showMessage('success', 'Tạo gói mới thành công');
            }

            setShowForm(false);
            loadPlans();
        } catch (error: any) {
            console.error('Error saving plan:', error);
            showMessage('error', error.message || 'Lỗi khi lưu gói');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa gói này?')) return;

        try {
            await api.adminDeleteSubscriptionPlan(id);
            showMessage('success', 'Xóa gói thành công');
            loadPlans();
        } catch (error) {
            console.error('Error deleting plan:', error);
            showMessage('error', 'Lỗi khi xóa gói');
        }
    };

    const addFeature = () => {
        setFormData({
            ...formData,
            features: [...formData.features, '']
        });
    };

    const removeFeature = (index: number) => {
        setFormData({
            ...formData,
            features: formData.features.filter((_, i) => i !== index)
        });
    };

    const updateFeature = (index: number, value: string) => {
        const newFeatures = [...formData.features];
        newFeatures[index] = value;
        setFormData({
            ...formData,
            features: newFeatures
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Quản lý gói đăng ký</h2>
                <button
                    onClick={handleCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tạo gói mới
                </button>
            </div>

            {message && (
                <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {/* Plans List */}
            {!showForm && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map(plan => (
                        <div key={plan.id} className={`bg-white rounded-lg shadow-md p-6 border-2 ${plan.bestChoice ? 'border-green-500 shadow-lg' : plan.popular ? 'border-yellow-400' : 'border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                                    <p className="text-sm text-slate-500">ID: {plan.planId}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {plan.bestChoice && (
                                        <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                                            ⭐ BEST CHOICE
                                        </span>
                                    )}
                                    {plan.popular && (
                                        <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold">
                                            PHỔ BIẾN
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="text-3xl font-bold text-blue-600 mb-2">
                                    {(plan.price / 1000).toFixed(0)}.000đ
                                </div>
                                <div className="space-y-1 text-sm text-slate-600">
                                    <div>💎 {plan.aiQuota} lượt AI search</div>
                                    <div>⏱️ {plan.duration} ngày</div>
                                    <div>📊 Thứ tự: {plan.displayOrder}</div>
                                    <div>
                                        {plan.isActive ? (
                                            <span className="text-green-600">✓ Đang kích hoạt</span>
                                        ) : (
                                            <span className="text-red-600">✗ Đã tắt</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <h4 className="font-semibold text-sm text-slate-700 mb-2">Tính năng:</h4>
                                <ul className="space-y-1 text-sm text-slate-600">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <span className="text-green-500 mt-0.5">✓</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(plan)}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm"
                                >
                                    Sửa
                                </button>
                                <button
                                    onClick={() => handleDelete(plan.id)}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">
                        {editingPlan ? 'Sửa gói đăng ký' : 'Tạo gói mới'}
                    </h3>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Plan ID *
                                </label>
                                <input
                                    type="text"
                                    value={formData.planId}
                                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    disabled={!!editingPlan}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tên gói *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Giá (VND) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    min="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    AI Quota *
                                </label>
                                <input
                                    type="number"
                                    value={formData.aiQuota}
                                    onChange={(e) => setFormData({ ...formData, aiQuota: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    min="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Thời hạn (ngày) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Thứ tự hiển thị
                                </label>
                                <input
                                    type="number"
                                    value={formData.displayOrder}
                                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">Kích hoạt</span>
                            </label>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.popular}
                                    onChange={(e) => setFormData({ ...formData, popular: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">Gói phổ biến</span>
                            </label>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.bestChoice}
                                    onChange={(e) => setFormData({ ...formData, bestChoice: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">Best Choice ⭐</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Tính năng
                            </label>
                            <div className="space-y-2">
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={feature}
                                            onChange={(e) => updateFeature(index, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Nhập tính năng"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeFeature(index)}
                                            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addFeature}
                                    className="w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600"
                                >
                                    + Thêm tính năng
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                            >
                                {editingPlan ? 'Cập nhật' : 'Tạo mới'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="flex-1 bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-lg"
                            >
                                Hủy
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default SubscriptionPlanManagement;
