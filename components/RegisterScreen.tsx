import React, { useState } from 'react';
import { api } from '../src/api';

interface RegisterScreenProps {
    onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onSwitchToLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username || !password || !name) {
            setError('Vui lòng điền đầy đủ thông tin.');
            setLoading(false);
            return;
        }

        try {
            await api.post('/api/auth/register', { username, password, name });
            setSuccess(true);
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

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-sky-50 to-green-100 p-4">
                <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-sm text-center">
                    <h1 className="text-2xl font-bold text-slate-800 mb-4">Đăng ký thành công!</h1>
                    <p className="text-slate-600 mb-6">Bây giờ bạn có thể đăng nhập với tài khoản vừa tạo.</p>
                    <button
                        onClick={onSwitchToLogin}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg"
                    >
                        Đi đến trang đăng nhập
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 p-4">
            <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-sm">
                <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Tạo tài khoản</h1>
                <form onSubmit={handleRegister}>
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
                            placeholder="Nguyễn Văn A"
                            disabled={loading}
                        />
                    </div>
                    <div className="mb-4">
                        <label className="block text-slate-700 text-sm font-bold mb-2" htmlFor="username">
                            Tên đăng nhập
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="tendangnhap"
                            disabled={loading}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-slate-700 text-sm font-bold mb-2" htmlFor="password">
                            Mật khẩu
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-slate-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="******************"
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={loading}
                        >
                            {loading ? 'Đang xử lý...' : 'Đăng ký'}
                        </button>
                    </div>
                </form>
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-600">
                        Đã có tài khoản?{' '}
                        <button onClick={onSwitchToLogin} className="font-bold text-blue-600 hover:text-blue-800">
                            Đăng nhập
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterScreen;
