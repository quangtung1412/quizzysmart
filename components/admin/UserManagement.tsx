import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface User {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  branchCode: string | null;
  role: string;
  aiSearchQuota: number;
  hasQuickSearchAccess: boolean;
  premiumPlan: string | null;
  premiumExpiresAt: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

interface UserFormData {
  username: string;
  password: string;
  email: string;
  name: string;
  branchCode: string;
  role: string;
  aiSearchQuota: number;
  hasQuickSearchAccess: boolean;
  premiumPlan: string;
  premiumExpiresAt: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState('all');
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    email: '',
    name: '',
    branchCode: '',
    role: 'user',
    aiSearchQuota: 10,
    hasQuickSearchAccess: false,
    premiumPlan: '',
    premiumExpiresAt: '',
  });
  const [formErrors, setFormErrors] = useState<string>('');

  const ROOT_USER_EMAIL = 'quangtung1412@gmail.com';

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.adminListUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const response = await api.me();
      setCurrentUser(response.user);
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
  }, []);

  const isRootUser = (user: User | null): boolean => {
    return user?.email === ROOT_USER_EMAIL;
  };

  const canEditUser = (targetUser: User): boolean => {
    // Root user can edit anyone
    if (isRootUser(currentUser)) return true;
    // Non-root users cannot edit the root user
    if (isRootUser(targetUser)) return false;
    return true;
  };

  const getUserSubscriptionType = (user: User): string => {
    if (user.subscriptionPlan && user.subscriptionStatus === 'active') {
      const expiresAt = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
      if (expiresAt && expiresAt > new Date()) {
        return user.subscriptionPlan; // 'plus' or 'premium'
      }
    }
    return 'regular'; // No active subscription
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;

    const userSubscriptionType = getUserSubscriptionType(user);
    const matchesSubscription = selectedSubscriptionType === 'all' || userSubscriptionType === selectedSubscriptionType;

    return matchesSearch && matchesRole && matchesSubscription;
  }).sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'name':
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
      case 'email':
        aValue = a.email?.toLowerCase() || '';
        bValue = b.email?.toLowerCase() || '';
        break;
      case 'subscription':
        aValue = getUserSubscriptionType(a);
        bValue = getUserSubscriptionType(b);
        break;
      case 'expiresAt':
        aValue = a.subscriptionExpiresAt ? new Date(a.subscriptionExpiresAt).getTime() : 0;
        bValue = b.subscriptionExpiresAt ? new Date(b.subscriptionExpiresAt).getTime() : 0;
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      default:
        aValue = a.createdAt;
        bValue = b.createdAt;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPremiumBadgeColor = (plan: string | null) => {
    switch (plan) {
      case 'premium': return 'bg-yellow-100 text-yellow-800';
      case 'plus': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleCreateUser = async () => {
    setFormErrors('');

    if (!formData.username && !formData.email) {
      setFormErrors('Phải có ít nhất username hoặc email');
      return;
    }

    try {
      const userData: any = {
        username: formData.username || undefined,
        password: formData.password || undefined,
        email: formData.email || undefined,
        name: formData.name || undefined,
        branchCode: formData.branchCode || undefined,
        role: formData.role,
        aiSearchQuota: formData.aiSearchQuota,
        hasQuickSearchAccess: formData.hasQuickSearchAccess,
        premiumPlan: formData.premiumPlan || null,
        premiumExpiresAt: formData.premiumExpiresAt || null,
      };

      await api.adminCreateUser(userData);
      await loadUsers();
      setShowCreateModal(false);
      resetForm();
    } catch (error: any) {
      setFormErrors(error.message || 'Không thể tạo người dùng');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setFormErrors('');

    try {
      const userData: any = {
        username: formData.username || undefined,
        email: formData.email || undefined,
        name: formData.name || undefined,
        branchCode: formData.branchCode || undefined,
        role: formData.role,
        aiSearchQuota: formData.aiSearchQuota,
        hasQuickSearchAccess: formData.hasQuickSearchAccess,
        premiumPlan: formData.premiumPlan || null,
        premiumExpiresAt: formData.premiumExpiresAt || null,
      };

      if (formData.password) {
        userData.password = formData.password;
      }

      await api.adminUpdateUser(selectedUser.id, userData);
      await loadUsers();
      setShowEditModal(false);
      resetForm();
    } catch (error: any) {
      setFormErrors(error.message || 'Không thể cập nhật người dùng');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await api.adminDeleteUser(selectedUser.id);
      await loadUsers();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      alert(error.message || 'Không thể xóa người dùng');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username || '',
      password: '',
      email: user.email || '',
      name: user.name || '',
      branchCode: user.branchCode || '',
      role: user.role,
      aiSearchQuota: user.aiSearchQuota,
      hasQuickSearchAccess: user.hasQuickSearchAccess,
      premiumPlan: user.premiumPlan || '',
      premiumExpiresAt: user.premiumExpiresAt ? new Date(user.premiumExpiresAt).toISOString().split('T')[0] : '',
    });
    setFormErrors('');
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      email: '',
      name: '',
      branchCode: '',
      role: 'user',
      aiSearchQuota: 10,
      hasQuickSearchAccess: false,
      premiumPlan: '',
      premiumExpiresAt: '',
    });
    setFormErrors('');
    setSelectedUser(null);
  };

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h3 className="text-lg md:text-xl font-semibold text-slate-800">Quản lý người dùng</h3>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors w-full sm:w-auto"
        >
          <span className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Thêm người dùng</span>
            <span className="sm:hidden">Thêm</span>
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, email hoặc username..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value)}
          title="Lọc theo vai trò"
        >
          <option value="all">Tất cả vai trò</option>
          <option value="admin">Admin</option>
          <option value="user">Người dùng</option>
        </select>
        <select
          className="px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          value={selectedSubscriptionType}
          onChange={e => setSelectedSubscriptionType(e.target.value)}
          title="Lọc theo loại tài khoản"
        >
          <option value="all">Tất cả loại tài khoản</option>
          <option value="regular">Người dùng thường</option>
          <option value="plus">Plus</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="p-3 md:p-4 bg-white rounded-lg shadow border-l-4 border-blue-500">
          <h4 className="text-xs md:text-sm font-semibold text-slate-600">Tổng người dùng</h4>
          <p className="text-xl md:text-2xl font-bold text-blue-600">{users.length}</p>
        </div>
        <div className="p-3 md:p-4 bg-white rounded-lg shadow border-l-4 border-red-500">
          <h4 className="text-xs md:text-sm font-semibold text-slate-600">Admin</h4>
          <p className="text-xl md:text-2xl font-bold text-red-600">{users.filter(u => u.role === 'admin').length}</p>
        </div>
        <div className="p-3 md:p-4 bg-white rounded-lg shadow border-l-4 border-slate-400">
          <h4 className="text-xs md:text-sm font-semibold text-slate-600">Thường</h4>
          <p className="text-xl md:text-2xl font-bold text-slate-600">{users.filter(u => getUserSubscriptionType(u) === 'regular').length}</p>
        </div>
        <div className="p-3 md:p-4 bg-white rounded-lg shadow border-l-4 border-purple-500">
          <h4 className="text-xs md:text-sm font-semibold text-slate-600">Plus</h4>
          <p className="text-xl md:text-2xl font-bold text-purple-600">{users.filter(u => getUserSubscriptionType(u) === 'plus').length}</p>
        </div>
        <div className="p-3 md:p-4 bg-white rounded-lg shadow border-l-4 border-yellow-500 col-span-2 sm:col-span-1">
          <h4 className="text-xs md:text-sm font-semibold text-slate-600">Premium</h4>
          <p className="text-xl md:text-2xl font-bold text-yellow-600">{users.filter(u => getUserSubscriptionType(u) === 'premium').length}</p>
        </div>
      </div>

      {/* User List - Table on Desktop, Cards on Mobile */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600"></div>
            <p className="mt-2 text-slate-500">Đang tải...</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th
                      className="px-6 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Người dùng
                        {sortColumn === 'name' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center gap-1">
                        Email/Username
                        {sortColumn === 'email' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">Chi nhánh</th>
                    <th className="px-6 py-3 font-medium text-slate-600">Vai trò</th>
                    <th className="px-6 py-3 font-medium text-slate-600">AI Quota</th>
                    <th
                      className="px-6 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('subscription')}
                    >
                      <div className="flex items-center gap-1">
                        Gói đăng ký
                        {sortColumn === 'subscription' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('expiresAt')}
                    >
                      <div className="flex items-center gap-1">
                        Hết hạn
                        {sortColumn === 'expiresAt' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">Tra cứu nhanh</th>
                    <th
                      className="px-6 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Ngày tham gia
                        {sortColumn === 'createdAt' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 font-medium text-slate-600">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map(user => {
                    const subscriptionType = getUserSubscriptionType(user);
                    const isPremiumUser = subscriptionType === 'plus' || subscriptionType === 'premium';
                    const rowClass = isPremiumUser
                      ? subscriptionType === 'premium'
                        ? 'hover:bg-yellow-50 bg-gradient-to-r from-yellow-50 to-transparent border-l-4 border-yellow-400'
                        : 'hover:bg-purple-50 bg-gradient-to-r from-purple-50 to-transparent border-l-4 border-purple-400'
                      : 'hover:bg-slate-50';

                    return (
                      <tr key={user.id} className={`transition-colors ${rowClass}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${subscriptionType === 'premium' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                              subscriptionType === 'plus' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                                'bg-gradient-to-br from-blue-500 to-indigo-600'
                              }`}>
                              {(user.name || user.username || user.email || 'U')[0].toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <div className="font-medium text-slate-900 flex items-center gap-2">
                                {user.name || 'Chưa có tên'}
                                {subscriptionType === 'premium' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    PREMIUM
                                  </span>
                                )}
                                {subscriptionType === 'plus' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-400 to-purple-500 text-white">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                    </svg>
                                    PLUS
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-900">{user.email || '-'}</div>
                          {user.username && <div className="text-xs text-slate-500">@{user.username}</div>}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{user.branchCode || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                            {user.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.202.592.037.051.08.102.128.152z" />
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-6a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.33.744.74.925 1.2a.75.75 0 01-1.395.55 1.35 1.35 0 00-.447-.563 2.187 2.187 0 00-.736-.363V9.3c.698.093 1.383.32 1.959.696.787.514 1.29 1.27 1.29 2.13 0 .86-.504 1.616-1.29 2.13-.576.377-1.261.603-1.96.696v.299a.75.75 0 11-1.5 0v-.3c-.697-.092-1.382-.318-1.958-.695-.482-.315-.857-.717-1.078-1.188a.75.75 0 111.359-.636c.08.173.245.376.54.569.313.205.706.353 1.138.432v-2.748a3.782 3.782 0 01-1.653-.713C6.9 9.433 6.5 8.681 6.5 7.875c0-.805.4-1.558 1.097-2.096a3.78 3.78 0 011.653-.713V4.75A.75.75 0 0110 4z" clipRule="evenodd" />
                            </svg>
                            {user.aiSearchQuota}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.subscriptionPlan && user.subscriptionStatus === 'active' ? (
                            <div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.subscriptionPlan === 'premium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : user.subscriptionPlan === 'plus'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-600'
                                }`}>
                                {user.subscriptionPlan.toUpperCase()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Thường</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.subscriptionExpiresAt && user.subscriptionStatus === 'active' ? (
                            <div className="text-xs">
                              <div className="text-slate-900 font-medium">
                                {new Date(user.subscriptionExpiresAt).toLocaleDateString('vi-VN')}
                              </div>
                              <div className="text-slate-500">
                                ({Math.ceil((new Date(user.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} ngày)
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.hasQuickSearchAccess ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Có
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4">
                          {canEditUser(user) ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(user)}
                                className="text-sky-600 hover:text-sky-900 font-medium transition-colors"
                                title="Chỉnh sửa"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(user)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Xóa"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-red-400 to-red-500 text-white">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              ROOT
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-slate-200">
              {filteredUsers.map(user => {
                const subscriptionType = getUserSubscriptionType(user);
                const isPremiumUser = subscriptionType === 'plus' || subscriptionType === 'premium';
                const cardClass = isPremiumUser
                  ? subscriptionType === 'premium'
                    ? 'bg-gradient-to-r from-yellow-50 to-transparent border-l-4 border-yellow-400'
                    : 'bg-gradient-to-r from-purple-50 to-transparent border-l-4 border-purple-400'
                  : '';

                return (
                  <div key={user.id} className={`p-4 ${cardClass}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0 ${subscriptionType === 'premium' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                            subscriptionType === 'plus' ? 'bg-gradient-to-br from-purple-500 to-purple-700' :
                              'bg-gradient-to-br from-blue-500 to-indigo-600'
                          }`}>
                          {(user.name || user.username || user.email || 'U')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">{user.name || 'Chưa có tên'}</div>
                          <div className="text-xs text-slate-500 truncate">{user.email || user.username || '-'}</div>
                        </div>
                      </div>
                      {canEditUser(user) && (
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                            title="Chỉnh sửa"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                            title="Xóa"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {isRootUser(user) && !canEditUser(user) && (
                        <div className="ml-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-red-400 to-red-500 text-white">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            ROOT
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">Vai trò:</span>
                        <div className="mt-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                            {user.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Gói:</span>
                        <div className="mt-0.5">
                          {subscriptionType === 'premium' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              PREMIUM
                            </span>
                          )}
                          {subscriptionType === 'plus' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-400 to-purple-500 text-white">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                              </svg>
                              PLUS
                            </span>
                          )}
                          {subscriptionType === 'regular' && (
                            <span className="text-slate-400 text-xs">Thường</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">AI Quota:</span>
                        <div className="mt-0.5 text-blue-700 font-semibold">{user.aiSearchQuota}</div>
                      </div>
                      {user.subscriptionExpiresAt && user.subscriptionStatus === 'active' && (
                        <div>
                          <span className="text-slate-500 text-xs">Hết hạn:</span>
                          <div className="mt-0.5 text-slate-900 text-xs">
                            {new Date(user.subscriptionExpiresAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">Không tìm thấy người dùng</h3>
            <p className="mt-1 text-sm text-slate-500">Thử thay đổi bộ lọc tìm kiếm.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-800">
                {showCreateModal ? 'Tạo người dùng mới' : 'Chỉnh sửa người dùng'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {formErrors && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {formErrors}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="username123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mật khẩu {showEditModal && <span className="text-slate-500">(để trống nếu không đổi)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên hiển thị</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mã chi nhánh</label>
                  <input
                    type="text"
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="CN001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    title="Chọn vai trò người dùng"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">AI Search Quota</label>
                  <input
                    type="number"
                    value={formData.aiSearchQuota}
                    onChange={(e) => setFormData({ ...formData, aiSearchQuota: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    min="0"
                    title="Số lượng AI search quota"
                    placeholder="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gói Premium</label>
                  <select
                    value={formData.premiumPlan}
                    onChange={(e) => setFormData({ ...formData, premiumPlan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    title="Chọn gói premium"
                  >
                    <option value="">Không có</option>
                    <option value="plus">Plus</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày hết hạn Premium</label>
                  <input
                    type="date"
                    value={formData.premiumExpiresAt}
                    onChange={(e) => setFormData({ ...formData, premiumExpiresAt: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    title="Ngày hết hạn premium"
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="quickSearch"
                    checked={formData.hasQuickSearchAccess}
                    onChange={(e) => setFormData({ ...formData, hasQuickSearchAccess: e.target.checked })}
                    className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-300 rounded"
                  />
                  <label htmlFor="quickSearch" className="ml-2 block text-sm text-slate-700">
                    Cho phép Tra cứu nhanh
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={showCreateModal ? handleCreateUser : handleUpdateUser}
                className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors"
              >
                {showCreateModal ? 'Tạo người dùng' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-center text-slate-900">Xác nhận xóa người dùng</h3>
              <p className="mt-2 text-sm text-center text-slate-600">
                Bạn có chắc chắn muốn xóa người dùng <strong>{selectedUser.name || selectedUser.email || selectedUser.username}</strong>?
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Xóa người dùng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
