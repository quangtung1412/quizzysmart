import React from 'react';

interface LoginScreenProps {
  onLoginSuccess: (user: { name: string; email: string; picture: string }) => void;
}

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M24 9.5c3.23 0 6.13 1.11 8.4 3.29l6.59-6.59C34.54 2.22 29.5 0 24 0 14.62 0 6.68 5.58 3.02 13.59l7.74 6.01C12.55 13.43 17.86 9.5 24 9.5z"></path>
        <path fill="#34A853" d="M46.98 24.55c0-1.56-.14-3.09-.4-4.55H24v8.51h12.87c-.55 2.76-2.19 5.1-4.67 6.68l7.39 5.72C44.47 36.64 46.98 31.09 46.98 24.55z"></path>
        <path fill="#FBBC05" d="M10.76 27.61c-.41-1.23-.64-2.55-.64-3.92s.23-2.69.64-3.92l-7.74-6.01C1.13 16.2 0 19.98 0 24c0 4.02 1.13 7.8 3.02 10.41l7.74-6.8z"></path>
        <path fill="#EA4335" d="M24 48c5.44 0 10.22-1.81 13.62-4.89l-7.39-5.72c-1.81 1.23-4.14 1.95-6.23 1.95-6.14 0-11.45-3.94-13.29-9.28l-7.74 6.01C6.68 42.42 14.62 48 24 48z"></path>
        <path fill="none" d="M0 0h48v48H0z"></path>
    </svg>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const handleLogin = () => {
    // Determine base URL dynamically (support production domain or current origin)
  const origin = window.location.origin.replace(/\/$/, '');
    // If running on file:// or unusual, fallback to env style
    const isProdDomain = /giadinhnhimsoc\.site$/i.test(location.hostname) || /13\.229\.10\.40/.test(location.hostname);
  const isDev = origin.includes(':5173');
  const backendBase = isDev ? 'http://localhost:3000' : origin;
  window.location.href = backendBase + '/api/auth/google';
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <h2 className="text-2xl font-semibold text-slate-700 mb-4">Chào mừng bạn đến với Quiz Master</h2>
      <p className="text-slate-500 mb-8 max-w-md">
        Vui lòng đăng nhập để tạo, quản lý và thực hiện các bài kiểm tra của bạn.
      </p>
      <button
        onClick={handleLogin}
        className="flex items-center justify-center px-6 py-3 bg-white border border-slate-300 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
      >
        <GoogleIcon />
        <span className="font-medium text-slate-700">Đăng nhập với Google</span>
      </button>
    </div>
  );
};

export default LoginScreen;
