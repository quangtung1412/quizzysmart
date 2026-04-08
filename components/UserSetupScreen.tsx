import React, { useState } from 'react';
import { api } from '../src/api';
import { User } from '../types';

interface UserSetupScreenProps {
    user: User;
    onSetupComplete: (updatedUser: User) => void;
    onLogout: () => void;
}

const UserSetupScreen: React.FC<UserSetupScreenProps> = ({ user, onSetupComplete, onLogout }) => {
    const [name, setName] = useState(user.name || '');
    const [branchCode, setBranchCode] = useState(user.branchCode || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const allowedBranchCodes = ["2300", "2301", "2302", "2305", "2306", "2308", "2309", "2310", "2312", "2313"];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!name.trim()) {
            setError('Vui lòng nhập tên hiển thị.');
            setLoading(false);
            return;
        }

        if (!branchCode.trim()) {
            setError('Vui lòng nhập mã chi nhánh.');
            setLoading(false);
            return;
        }

        if (!allowedBranchCodes.includes(branchCode.trim())) {
            setError('Mã chi nhánh không hợp lệ. Bạn sẽ được đăng xuất.');
            setLoading(false);
            // Đăng xuất người dùng sau 2 giây để họ có thể đọc thông báo lỗi
            setTimeout(async () => {
                try {
                    await api.logout();
                } catch (err) {
                    console.error('Logout error:', err);
                } finally {
                    onLogout();
                }
            }, 2000);
            return;
        }

        try {
            const response = await api.put('/api/user/details', { name: name.trim(), branchCode: branchCode.trim() });
            onSetupComplete((response as any).user);
        } catch (err: any) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Đã xảy ra lỗi. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 p-4">
            <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Hoàn thiện thông tin</h1>
                    <p className="text-slate-600">Vui lòng cung cấp thông tin bổ sung để tiếp tục</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-slate-700 text-sm font-bold mb-2" htmlFor="name">
                            Tên hiển thị
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Nhập tên hiển thị của bạn"
                            disabled={loading}
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-slate-700 text-sm font-bold mb-2" htmlFor="branchCode">
                            Mã chi nhánh
                        </label>
                        <input
                            id="branchCode"
                            type="text"
                            value={branchCode}
                            onChange={(e) => setBranchCode(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Nhập mã chi nhánh"
                            disabled={loading}
                            maxLength={4}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Nhập mã chi nhánh nơi bạn làm việc để xác thực tài khoản
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                        disabled={loading}
                    >
                        {loading ? 'Đang xử lý...' : 'Hoàn thành'}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default UserSetupScreen;
