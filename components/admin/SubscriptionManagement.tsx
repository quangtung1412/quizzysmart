import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface User {
    id: string;
    email: string;
    username?: string;
    name: string;
    role: string;
}

interface SubscriptionPlan {
    id: string;
    name: string;
    tier: string;
    price: number;
    durationDays: number;
}

interface Subscription {
    id: string;
    userId: string;
    planId: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
    notes?: string;
    user: User;
    plan: SubscriptionPlan;
}

const SubscriptionManagement: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        userId: '',
        planId: '',
        durationDays: '',
        notes: '',
        status: 'active',
        expiresAt: ''
    });

    const [extendDays, setExtendDays] = useState(30);

    useEffect(() => {
        fetchData();
    }, [statusFilter]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [subsData, usersData, plansData] = await Promise.all([
                api.getAdminSubscriptions(statusFilter),
                api.getAdminUsers(),
                api.getAdminSubscriptionPlans()
            ]);

            setSubscriptions(subsData);
            setUsers(usersData);
            setPlans(plansData);
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createAdminSubscription({
                userId: formData.userId,
                planId: formData.planId,
                durationDays: formData.durationDays ? parseInt(formData.durationDays) : undefined,
                notes: formData.notes
            });

            setShowCreateModal(false);
            resetForm();
            fetchData();
            alert('Subscription created successfully!');
        } catch (err: any) {
            alert(err.message || 'Failed to create subscription');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubscription) return;

        try {
            await api.updateAdminSubscription(selectedSubscription.id, {
                status: formData.status,
                expiresAt: formData.expiresAt,
                notes: formData.notes
            });

            setShowEditModal(false);
            setSelectedSubscription(null);
            resetForm();
            fetchData();
            alert('Subscription updated successfully!');
        } catch (err: any) {
            alert(err.message || 'Failed to update subscription');
        }
    };

    const handleExtend = async () => {
        if (!selectedSubscription) return;

        try {
            await api.extendAdminSubscription(selectedSubscription.id, extendDays);
            setShowExtendModal(false);
            setSelectedSubscription(null);
            setExtendDays(30);
            fetchData();
            alert(`Subscription extended by ${extendDays} days!`);
        } catch (err: any) {
            alert(err.message || 'Failed to extend subscription');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this subscription?')) return;

        try {
            await api.deleteAdminSubscription(id);
            fetchData();
            alert('Subscription deleted successfully!');
        } catch (err: any) {
            alert(err.message || 'Failed to delete subscription');
        }
    };

    const resetForm = () => {
        setFormData({
            userId: '',
            planId: '',
            durationDays: '',
            notes: '',
            status: 'active',
            expiresAt: ''
        });
    };

    const openEditModal = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setFormData({
            userId: subscription.userId,
            planId: subscription.planId,
            durationDays: '',
            notes: subscription.notes || '',
            status: subscription.status,
            expiresAt: subscription.expiresAt ? subscription.expiresAt.split('T')[0] : ''
        });
        setShowEditModal(true);
    };

    const openExtendModal = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setShowExtendModal(true);
    };

    // Filter subscriptions
    const filteredSubscriptions = subscriptions.filter(sub => {
        const matchesSearch = searchQuery.trim() === '' ||
            sub.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.plan.name.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSearch;
    });

    const getStatusBadge = (status: string, expiresAt: string | null) => {
        if (status === 'pending') {
            return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Pending</span>;
        }

        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

        if (isExpired && status === 'active') {
            return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Expired</span>;
        }

        switch (status) {
            case 'active':
                return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Active</span>;
            case 'cancelled':
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">Cancelled</span>;
            case 'expired':
                return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Expired</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">{status}</span>;
        }
    };

    const getTierBadge = (tier: string) => {
        switch (tier) {
            case 'premium':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Premium</span>;
            case 'plus':
                return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Plus</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">{tier}</span>;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRemainingDays = (expiresAt: string | null) => {
        if (!expiresAt) return null;
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Subscription Management</h2>
                    <p className="text-sm text-slate-600 mt-1">Manage user subscriptions and plans</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Subscription
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search by user email, name, or plan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <div className="text-sm text-slate-600">Total Subscriptions</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{subscriptions.length}</div>
                </div>
                <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-4">
                    <div className="text-sm text-orange-600">Pending</div>
                    <div className="text-2xl font-bold text-orange-700 mt-1">
                        {subscriptions.filter(s => s.status === 'pending').length}
                    </div>
                </div>
                <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                    <div className="text-sm text-green-600">Active</div>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                        {subscriptions.filter(s => s.status === 'active' && s.expiresAt && new Date(s.expiresAt) > new Date()).length}
                    </div>
                </div>
                <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-4">
                    <div className="text-sm text-red-600">Expired</div>
                    <div className="text-2xl font-bold text-red-700 mt-1">
                        {subscriptions.filter(s => s.expiresAt && new Date(s.expiresAt) < new Date()).length}
                    </div>
                </div>
                <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-600">Cancelled</div>
                    <div className="text-2xl font-bold text-gray-700 mt-1">
                        {subscriptions.filter(s => s.status === 'cancelled').length}
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Subscriptions Table */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plan</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Created</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Expires</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Remaining</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredSubscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                        No subscriptions found
                                    </td>
                                </tr>
                            ) : (
                                filteredSubscriptions.map((sub) => {
                                    const remainingDays = getRemainingDays(sub.expiresAt);
                                    return (
                                        <tr key={sub.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <div className="font-medium text-slate-900">{sub.user.name}</div>
                                                    <div className="text-sm text-slate-500">{sub.user.email}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <div className="font-medium text-slate-900">{sub.plan.name}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {getTierBadge(sub.plan.tier)}
                                                        <span className="text-xs text-slate-500">{sub.plan.durationDays} days</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {getStatusBadge(sub.status, sub.expiresAt)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {formatDate(sub.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {formatDate(sub.expiresAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {remainingDays !== null ? (
                                                    <span className={`text-sm font-medium ${remainingDays < 0 ? 'text-red-600' :
                                                        remainingDays < 7 ? 'text-orange-600' :
                                                            'text-green-600'
                                                        }`}>
                                                        {remainingDays < 0 ? `${Math.abs(remainingDays)} days ago` : `${remainingDays} days`}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openExtendModal(sub)}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Extend subscription"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(sub)}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Edit subscription"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(sub.id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete subscription"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800">Create Subscription</h3>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">User</label>
                                <select
                                    value={formData.userId}
                                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Select user...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Plan</label>
                                <select
                                    value={formData.planId}
                                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Select plan...</option>
                                    {plans.map(plan => (
                                        <option key={plan.id} value={plan.planId}>
                                            {plan.name} - {plan.planId} ({plan.duration} days)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Duration (days) - Optional
                                </label>
                                <input
                                    type="number"
                                    value={formData.durationDays}
                                    onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                                    placeholder="Leave empty to use plan's default"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    placeholder="Add notes..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedSubscription && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800">Edit Subscription</h3>
                            <p className="text-sm text-slate-600 mt-1">{selectedSubscription.user.name}</p>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="active">Active</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="expired">Expired</option>
                                </select>
                                {formData.status === 'active' && selectedSubscription?.status === 'pending' && (
                                    <p className="mt-2 text-sm text-blue-600">
                                        💡 Activating will automatically set start date to now and calculate expiry date based on plan duration.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Expiry Date</label>
                                <input
                                    type="date"
                                    value={formData.expiresAt}
                                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedSubscription(null);
                                        resetForm();
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                    Update
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Extend Modal */}
            {showExtendModal && selectedSubscription && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-800">Extend Subscription</h3>
                            <p className="text-sm text-slate-600 mt-1">{selectedSubscription.user.name} - {selectedSubscription.plan.name}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Current Expiry</label>
                                <div className="text-lg font-semibold text-slate-800">
                                    {formatDate(selectedSubscription.expiresAt)}
                                </div>
                                <div className="text-sm text-slate-600 mt-1">
                                    {getRemainingDays(selectedSubscription.expiresAt)} days remaining
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Extend by (days)</label>
                                <input
                                    type="number"
                                    value={extendDays}
                                    onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                                    min="1"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="text-sm font-medium text-blue-800 mb-1">New Expiry Date</div>
                                <div className="text-lg font-semibold text-blue-900">
                                    {(() => {
                                        const baseDate = new Date(selectedSubscription.expiresAt) > new Date()
                                            ? new Date(selectedSubscription.expiresAt)
                                            : new Date();
                                        baseDate.setDate(baseDate.getDate() + extendDays);
                                        return formatDate(baseDate.toISOString());
                                    })()}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowExtendModal(false);
                                        setSelectedSubscription(null);
                                        setExtendDays(30);
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExtend}
                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                >
                                    Extend
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionManagement;
