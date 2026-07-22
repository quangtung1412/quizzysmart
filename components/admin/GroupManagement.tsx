import React, { useEffect, useState } from 'react';
import { api } from '../../src/api';

interface GroupMember {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string;
}

interface UserGroup {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  members: GroupMember[];
}

interface UserOption {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string;
}

const labelOf = (u: { name?: string | null; email?: string | null; username?: string | null }) =>
  u.name || u.email || u.username || 'Unknown';

const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [groupsData, usersData] = await Promise.all([
        api.adminListGroups(),
        api.adminListUsers()
      ]);
      setGroups(groupsData);
      setUsers(usersData);
    } catch (e) {
      console.error(e);
      alert('Không thể tải danh sách nhóm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setMemberIds([]);
    setMemberSearch('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (group: UserGroup) => {
    setEditing(group);
    setName(group.name);
    setDescription(group.description || '');
    setMemberIds(group.members.map(m => m.id));
    setMemberSearch('');
    setError('');
    setShowModal(true);
  };

  const toggleMember = (userId: string) => {
    setMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = users.filter(u => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      (u.email?.toLowerCase().includes(q) ?? false) ||
      (u.username?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Vui lòng nhập tên nhóm');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await api.adminUpdateGroup(editing.id, {
          name: name.trim(),
          description: description.trim(),
          memberIds
        });
      } else {
        await api.adminCreateGroup({
          name: name.trim(),
          description: description.trim(),
          memberIds
        });
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Không thể lưu nhóm');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (group: UserGroup) => {
    if (!window.confirm(`Xóa nhóm "${group.name}"?`)) return;
    setLoading(true);
    try {
      await api.adminDeleteGroup(group.id);
      await load();
    } catch (e) {
      alert('Không thể xóa nhóm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Nhóm người dùng</h3>
          <p className="text-sm text-slate-500">Tạo nhóm để gán bài thi theo nhóm khi tạo đề thi.</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm"
        >
          Thêm nhóm
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Đang tải...</div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Chưa có nhóm nào. Hãy tạo nhóm mới.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Tên nhóm</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mô tả</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Thành viên</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map(group => (
                <tr key={group.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{group.name}</td>
                  <td className="px-4 py-3 text-slate-600">{group.description || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800 font-medium">{group.memberCount} người</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs">
                      {group.members.slice(0, 5).map(labelOf).join(', ')}
                      {group.members.length > 5 ? '…' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button onClick={() => openEdit(group)} className="text-sky-600 hover:underline">Sửa</button>
                    <button onClick={() => handleDelete(group)} className="text-red-600 hover:underline">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h4 className="text-lg font-semibold">{editing ? 'Sửa nhóm' : 'Thêm nhóm'}</h4>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên nhóm *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                placeholder="Ví dụ: Chi nhánh 2300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2"
                rows={2}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Thành viên ({memberIds.length})
                </label>
                <div className="space-x-2 text-xs">
                  <button type="button" className="text-sky-600" onClick={() => setMemberIds(filteredUsers.map(u => u.id))}>
                    Chọn tất cả (lọc)
                  </button>
                  <button type="button" className="text-slate-500" onClick={() => setMemberIds([])}>
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Tìm người dùng..."
                className="w-full border border-slate-300 rounded-md px-3 py-2 mb-2 text-sm"
              />
              <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto">
                {filteredUsers.map(user => (
                  <label key={user.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 border-b last:border-b-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberIds.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{labelOf(user)}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email || user.username || user.role}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-md text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
