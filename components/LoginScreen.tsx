import React, { useState } from 'react';
import { api, API_BASE } from '../src/api';
import { User } from '../types';
import { getDeviceId, setSessionToken } from '../src/utils/deviceId';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToRegister: () => void;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M24 9.5c3.23 0 6.13 1.11 8.4 3.29l6.59-6.59C34.54 2.22 29.5 0 24 0 14.62 0 6.68 5.58 3.02 13.59l7.74 6.01C12.55 13.43 17.86 9.5 24 9.5z"></path>
    <path fill="#34A853" d="M46.98 24.55c0-1.56-.14-3.09-.4-4.55H24v8.51h12.87c-.55 2.76-2.19 5.1-4.67 6.68l7.39 5.72C44.47 36.64 46.98 31.09 46.98 24.55z"></path>
    <path fill="#FBBC05" d="M10.76 27.61c-.41-1.23-.64-2.55-.64-3.92s.23-2.69.64-3.92l-7.74-6.01C1.13 16.2 0 19.98 0 24c0 4.02 1.13 7.8 3.02 10.41l7.74-6.8z"></path>
    <path fill="#EA4335" d="M24 48c5.44 0 10.22-1.81 13.62-4.89l-7.39-5.72c-1.81 1.23-4.14 1.95-6.23 1.95-6.14 0-11.45-3.94-13.29-9.28l-7.74 6.01C6.68 42.42 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = () => {
    const deviceId = getDeviceId();
    window.location.href = `${API_BASE}/api/auth/google?deviceId=${encodeURIComponent(deviceId)}`;
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const response = await api.login(username, password, deviceId);

      // Store session token
      setSessionToken(response.sessionToken);

      // Show message if user was logged out from another device
      if (response.wasLoggedOutFromOtherDevice) {
        console.log('Previous device session has been terminated');
      }

      onLoginSuccess(response.user);
    } catch (err) {
      setError('Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 p-4 sm:p-6">
      <div className="p-6 sm:p-8 bg-white rounded-xl shadow-lg w-full max-w-sm sm:max-w-md border border-slate-200">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Chào mừng bạn</h1>
          <p className="text-sm sm:text-base text-slate-600">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleLocalLogin}>
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
              placeholder="Tên đăng nhập"
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
          {error && <p className="text-red-500 text-xs italic mb-4 text-center">{error}</p>}
          <div className="flex items-center justify-between mb-4">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              disabled={loading}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </div>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">hoặc</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-lg flex items-center justify-center transition-all duration-200"
        >
          <GoogleIcon />
          <span>Đăng nhập với Google</span>
        </button>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            Chưa có tài khoản?{' '}
            <button onClick={onSwitchToRegister} className="font-bold text-blue-600 hover:text-blue-800">
              Đăng ký
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
