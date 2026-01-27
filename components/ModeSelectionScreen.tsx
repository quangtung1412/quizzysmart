import React, { useState, useEffect } from 'react';
import { api } from '../src/api';

interface ModeSelectionScreenProps {
  onSelectPracticeMode: () => void;
  onSelectTestMode: () => void;
  onSelectQuickSearchMode: () => void;
  onSelectPremiumMode?: () => void;
  onAdminPanel?: () => void;
  onGoToPremiumPlans?: () => void;
  userName: string;
  isAdmin?: boolean;
  user?: any;
}

const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({
  onSelectPracticeMode,
  onSelectTestMode,
  onSelectQuickSearchMode,
  onSelectPremiumMode,
  onAdminPanel,
  onGoToPremiumPlans,
  userName,
  isAdmin,
  user
}) => {
  const [isPeakHours, setIsPeakHours] = useState(false);
  const [peakHoursInfo, setPeakHoursInfo] = useState<any>(null);
  const [showPeakHoursModal, setShowPeakHoursModal] = useState(false);

  // Check if user is premium - matching App.tsx logic
  const isPremiumUser = isAdmin || (
    user?.premiumPlan &&
    (user.premiumPlan === 'plus' || user.premiumPlan === 'premium') &&
    (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date())
  );

  // Check peak hours status on mount
  useEffect(() => {
    const checkPeakHours = async () => {
      try {
        const status = await api.getPeakHoursStatus();
        setIsPeakHours(status.isPeakHours && status.enabled);
        setPeakHoursInfo(status);
      } catch (error) {
        console.error('Error checking peak hours:', error);
      }
    };

    checkPeakHours();
    // Check every minute
    const interval = setInterval(checkPeakHours, 60000);
    return () => clearInterval(interval);
  }, []);

  const isPremiumFeatureLocked = isPeakHours && !isPremiumUser;

  const showPeakHoursAlert = () => {
    setShowPeakHoursModal(true);
  };

  const handleUpgradeClick = () => {
    setShowPeakHoursModal(false);
    if (onGoToPremiumPlans) {
      onGoToPremiumPlans();
    }
  };

  const handleAIAssistantClick = () => {
    // Kiểm tra giờ cao điểm trước
    if (isPremiumFeatureLocked) {
      showPeakHoursAlert();
      return;
    }

    // Kiểm tra nếu user không phải admin và hết điểm
    if (user?.role !== 'admin' && user?.aiSearchQuota === 0) {
      // Redirect đến màn hình mua Premium
      if (onGoToPremiumPlans) {
        onGoToPremiumPlans();
      }
    } else {
      // Flow bình thường - vào premium intro
      if (onSelectPremiumMode) {
        onSelectPremiumMode();
      }
    }
  };

  const handleQuickSearchClick = () => {
    // Kiểm tra giờ cao điểm trước
    if (isPremiumFeatureLocked) {
      showPeakHoursAlert();
      return;
    }

    if (isPremiumUser || user?.quickSearchQuota > 0) {
      // Admin, Premium/Plus user, hoặc user còn quota: vào chức năng tra cứu
      onSelectQuickSearchMode();
    } else {
      // User thường hết quota: chuyển đến màn hình thanh toán
      if (onGoToPremiumPlans) {
        onGoToPremiumPlans();
      }
    }
  };

  // Kiểm tra xem có nên hiển thị nút nâng cấp cho quick search không
  const showQuickSearchUpgrade = !isPremiumUser && user?.quickSearchQuota === 0;
  const aiSearchQuotaText = !isAdmin && !user?.hasQuickSearchAccess
    ? `(${user?.aiSearchQuota || 0} lần dùng thử miễn phí)`
    : '';

  return (
    <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-5 px-2 sm:px-4 lg:px-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-700 mb-2 sm:mb-3">
          Chào mừng, {userName}!
        </h2>
        <p className="text-sm sm:text-base text-slate-600">
          Chọn chế độ học tập phù hợp với bạn
        </p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4`}>
        {/* Premium Mode - AI Assistant */}
        <div
          className={`bg-gradient-to-br ${isPremiumFeatureLocked ? 'from-gray-100 to-gray-200' : 'from-amber-50 to-yellow-100'} p-6 sm:p-8 rounded-2xl shadow-lg border-2 ${isPremiumFeatureLocked ? 'border-gray-300' : 'border-amber-300'} ${isPremiumFeatureLocked ? '' : 'hover:shadow-xl'} transition-all duration-300 ${isPremiumFeatureLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} group relative overflow-hidden`}
          onClick={handleAIAssistantClick}>
          {/* Peak Hours Badge */}
          {isPremiumFeatureLocked && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
              🔒 GIỜ CAO ĐIỂM
            </div>
          )}
          {/* Premium Badge */}
          <div className={`absolute top-3 right-3 ${isPremiumFeatureLocked ? 'bg-gray-400' : 'bg-gradient-to-r from-amber-500 to-yellow-500'} text-white text-xs font-bold px-3 py-1 rounded-full shadow-md`}>
            ✨ PREMIUM
          </div>
          <div className="flex flex-col items-center space-y-4 sm:space-y-6">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 ${isPremiumFeatureLocked ? 'bg-gray-400' : 'bg-gradient-to-br from-amber-500 to-yellow-500'} rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl ${isPremiumFeatureLocked ? '' : 'group-hover:scale-110'} transition-transform duration-300 shadow-lg`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <div>
              <h3 className={`text-xl sm:text-2xl font-bold ${isPremiumFeatureLocked ? 'text-gray-600' : 'text-amber-700'} mb-1.5 sm:mb-2`}>
                AI Trợ lý
              </h3>
              <p className={`${isPremiumFeatureLocked ? 'text-gray-500' : 'text-amber-600'} text-sm sm:text-base mb-2 sm:mb-3`}>
                Chụp ảnh câu hỏi, AI tìm đáp án
              </p>
              <ul className={`text-xs sm:text-sm ${isPremiumFeatureLocked ? 'text-gray-500' : 'text-amber-600'} space-y-1 sm:space-y-1.5 text-left`}>
                <li className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${isPremiumFeatureLocked ? 'text-gray-400' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Chụp ảnh hoặc upload câu hỏi</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${isPremiumFeatureLocked ? 'text-gray-400' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>AI nhận dạng tự động</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${isPremiumFeatureLocked ? 'text-gray-400' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tìm đáp án chính xác ngay lập tức</span>
                </li>
              </ul>
            </div>
            <button className={`${isPremiumFeatureLocked ? 'bg-gray-400' : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600'} text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-base min-h-[44px]`}>
              {isPremiumFeatureLocked ? '🔒 Giờ cao điểm' : 'Trải nghiệm'}
            </button>
          </div>
        </div>
        {/* Quick Search Mode - Tra cứu */}
        <div
          className={`bg-gradient-to-br ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'from-gray-100 to-gray-200' : 'from-purple-50 to-violet-100'} p-6 sm:p-8 rounded-2xl shadow-lg border ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'border-gray-300' : 'border-purple-200'} ${isPremiumFeatureLocked || showQuickSearchUpgrade ? '' : 'hover:shadow-xl'} transition-all duration-300 ${isPremiumFeatureLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} group relative overflow-hidden`}
          onClick={handleQuickSearchClick}>
          {/* Peak Hours Badge */}
          {isPremiumFeatureLocked && (
            <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
              🔒 GIỜ CAO ĐIỂM
            </div>
          )}
          {/* Premium Badge */}
          <div className={`absolute top-3 right-3 ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'bg-gray-400' : 'bg-gradient-to-r from-purple-500 to-violet-500'} text-white text-xs font-bold px-3 py-1 rounded-full shadow-md`}>
            ✨ PREMIUM
          </div>
          <div className="flex flex-col items-center space-y-4 sm:space-y-6">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'bg-gray-400' : 'bg-purple-500'} rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl ${isPremiumFeatureLocked || showQuickSearchUpgrade ? '' : 'group-hover:scale-110'} transition-transform duration-300`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h3 className={`text-xl sm:text-2xl font-bold ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'text-gray-600' : 'text-purple-700'} mb-1.5 sm:mb-2 flex items-center justify-center`}>
                <span>Tra cứu</span>

              </h3>
              <p className={`${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'text-gray-500' : 'text-purple-600'} text-sm sm:text-base mb-2 sm:mb-3`}>
                Tìm kiếm nhanh câu hỏi và đáp án
              </p>
              <ul className={`text-xs sm:text-sm ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'text-gray-500' : 'text-purple-600'} space-y-1 sm:space-y-1.5 text-left`}>
                <li className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'text-gray-400' : 'text-purple-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Chọn nhiều cơ sở kiến thức</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'text-gray-400' : 'text-purple-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tìm kiếm theo từ khóa</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className={`w-4 h-4 ${isPremiumFeatureLocked || showQuickSearchUpgrade ? 'text-gray-400' : 'text-purple-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Đánh dấu kết quả trùng khớp</span>
                </li>
              </ul>
            </div>
            <button className={`${isPremiumFeatureLocked ? 'bg-gray-400' : showQuickSearchUpgrade ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600' : 'bg-purple-500 hover:bg-purple-600'} text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-base min-h-[44px]`}>
              {isPremiumFeatureLocked ? '🔒 Giờ cao điểm' : showQuickSearchUpgrade ? 'Nâng cấp' : 'Thử ngay'}
            </button>
          </div>
        </div>
        {/* Practice Mode */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 sm:p-8 rounded-2xl shadow-lg border border-green-200 hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={onSelectPracticeMode}>
          <div className="flex flex-col items-center space-y-4 sm:space-y-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl group-hover:scale-110 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-1.5 sm:mb-2">Ôn luyện</h3>
              <p className="text-green-600 text-sm sm:text-base mb-2 sm:mb-3">
                Luyện tập với các bộ câu hỏi có sẵn
              </p>
              <ul className="text-xs sm:text-sm text-green-600 space-y-1 sm:space-y-1.5 text-left">
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Không giới hạn thời gian</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Xem đáp án ngay lập tức</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Tùy chỉnh số câu hỏi và danh mục</span>
                </li>
              </ul>
            </div>
            <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-colors duration-200 group-hover:bg-green-600 text-sm sm:text-base min-h-[44px]">
              Ôn luyện
            </button>
          </div>
        </div>

        {/* Test Mode */}
        <div className="bg-gradient-to-br from-blue-50 to-sky-100 p-6 sm:p-8 rounded-2xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300 cursor-pointer group"
          onClick={onSelectTestMode}>
          <div className="flex flex-col items-center space-y-4 sm:space-y-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl group-hover:scale-110 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h4.125m-6 0v-2.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-blue-700 mb-1.5 sm:mb-2">Thi</h3>
              <p className="text-blue-600 text-sm sm:text-base mb-2 sm:mb-3">
                Làm bài thi được phân công chính thức
              </p>
              <ul className="text-xs sm:text-sm text-blue-600 space-y-1 sm:space-y-1.5 text-left">
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Có giới hạn thời gian</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Giới hạn số lần làm bài</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Chấm điểm chính thức</span>
                </li>
              </ul>
            </div>
            <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-colors duration-200 group-hover:bg-blue-600 text-sm sm:text-base min-h-[44px]">
              Thử sức ngay
            </button>
          </div>
        </div>





      </div>

      {/* Admin Panel Button - Only visible for admins */}
      {isAdmin && onAdminPanel && (
        <div className="mt-6">
          <button
            onClick={onAdminPanel}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-3 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Quản trị hệ thống</span>
          </button>
        </div>
      )}

      <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-slate-100 rounded-lg">
        <p className="text-xs sm:text-sm text-slate-600">
          💡 <strong>Gợi ý:</strong> Sử dụng <span className="text-purple-600 font-semibold">Tra cứu</span> để tìm nhanh thông tin, <span className="text-green-600 font-semibold">Ôn luyện</span> để làm quen câu hỏi, <span className="text-blue-600 font-semibold">Thi</span> để kiểm tra năng lực, hoặc <span className="text-amber-600 font-semibold">AI Trợ lý</span> để tra cứu câu hỏi bằng hình ảnh.
        </p>
      </div>

      {/* Peak Hours Modal */}
      {showPeakHoursModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-red-500 p-6 text-white">
              <div className="flex items-center justify-center mb-3">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-center">Giờ cao điểm</h3>
              <p className="text-center text-amber-50 mt-2">
                {peakHoursInfo?.peakHoursStart} - {peakHoursInfo?.peakHoursEnd}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start space-x-3 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Tính năng bị hạn chế</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Hiện đang trong giờ cao điểm, tính năng này chỉ dành cho người dùng Premium.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-semibold text-slate-800">Nâng cấp Premium để:</p>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-700">Sử dụng không giới hạn mọi lúc</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-700">Không bị hạn chế giờ cao điểm</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-700">Quota AI tìm kiếm cao hơn</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-700">Ưu tiên hỗ trợ khách hàng</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowPeakHoursModal(false)}
                className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors duration-200"
              >
                Để sau
              </button>
              <button
                onClick={handleUpgradeClick}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 00-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 00-.552.698 5 5 0 004.503 5.152 6 6 0 002.946 1.822A6.451 6.451 0 017.768 13H7.5A1.5 1.5 0 006 14.5V17h-.75C4.56 17 4 17.56 4 18.25c0 .414.336.75.75.75h10.5a.75.75 0 00.75-.75c0-.69-.56-1.25-1.25-1.25H14v-2.5a1.5 1.5 0 00-1.5-1.5h-.268a6.453 6.453 0 01-.684-2.202 6 6 0 002.946-1.822 5 5 0 004.503-5.152.75.75 0 00-.552-.698A31.804 31.804 0 0016 2.562v-.387a.75.75 0 00-.629-.74A33.227 33.227 0 0010 1zM2.525 4.422C3.012 4.3 3.504 4.19 4 4.09V5c0 .74.134 1.448.38 2.103a3.503 3.503 0 01-1.855-2.68zm14.95 0a3.503 3.503 0 01-1.854 2.68C15.866 6.449 16 5.74 16 5v-.91c.496.099.988.21 1.475.332z" clipRule="evenodd" />
                </svg>
                Nâng cấp ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModeSelectionScreen;
