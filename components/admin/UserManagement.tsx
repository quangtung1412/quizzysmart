import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('all');

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

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'teacher': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-slate-800">Quản lý người dùng</h3>
        <button className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors">
          Thêm người dùng
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value)}
        >
          <option value="all">Tất cả vai trò</option>
          <option value="admin">Admin</option>
          <option value="user">Người dùng</option>
        </select>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-blue-500">
          <h4 className="font-semibold text-slate-600">Tổng người dùng</h4>
          <p className="text-2xl font-bold text-blue-600">{users.length}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-red-500">
          <h4 className="font-semibold text-slate-600">Admin</h4>
          <p className="text-2xl font-bold text-red-600">{users.filter(u => u.role === 'admin').length}</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow border-l-4 border-gray-500">
          <h4 className="font-semibold text-slate-600">Người dùng thường</h4>
          <p className="text-2xl font-bold text-gray-600">{users.filter(u => u.role === 'user').length}</p>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600"></div>
              <p className="mt-2 text-slate-500">Đang tải...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-600">Người dùng</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Email</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Vai trò</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Ngày tham gia</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-slate-300 rounded-full flex items-center justify-center text-sm font-medium">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-slate-900">{user.name || 'Chưa có tên'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role === 'admin' ? 'Admin' : 'Người dùng'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button className="text-sky-600 hover:text-sky-900 font-medium transition-colors">
                          Xem chi tiết
                        </button>
                        <button className="text-slate-400 hover:text-red-600 transition-colors">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
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
    </div>
  );
};

export default UserManagement;
