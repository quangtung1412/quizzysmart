import React from 'react';
import { API_BASE } from '../src/api';

interface LoginScreenProps {
  onLoginSuccess: (user: { name: string; email: string; picture: string }) => void;
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

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const handleLogin = () => {
    // Redirect the browser to the Google authentication endpoint on the server.
    // The server will then redirect to Google's login page.
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 p-4 sm:p-6">
      <div className="p-6 sm:p-8 bg-white rounded-xl shadow-lg w-full max-w-sm sm:max-w-md text-center border border-slate-200">
        <div className="mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Chào mừng bạn</h1>
          <p className="text-sm sm:text-base text-slate-600">Sử dụng tài khoản Google để đăng nhập</p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-medium py-3 sm:py-3.5 px-4 rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 min-h-[44px] text-sm sm:text-base"
        >
          <GoogleIcon />
          <span>Đăng nhập với Google</span>
        </button>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <p className="text-xs sm:text-sm text-slate-500">
            Bằng việc đăng nhập, bạn đồng ý với các điều khoản sử dụng của chúng tôi
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
