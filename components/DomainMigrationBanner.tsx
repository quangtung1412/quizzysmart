import React, { useState, useEffect } from 'react';

const NEW_DOMAIN = 'elearning.claymatium.com';
const OLD_DOMAIN = 'giadinhnhimsoc.site';
const DEADLINE = new Date('2026-04-11T00:00:00+07:00'); // 0h ngày 11/4/2026 (GMT+7)
const DomainMigrationBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const hostname = window.location.hostname;
    if (!hostname.includes(OLD_DOMAIN)) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const now = new Date();
      const diff = DEADLINE.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown('Đã hết hạn!');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${days} ngày ${hours} giờ ${minutes} phút`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const newUrl = `https://${NEW_DOMAIN}${window.location.pathname}${window.location.search}`;

  return (
    <>
      {/* Overlay - không cho dismiss */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" />
      
      {/* Popup */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-center text-slate-800 mb-2">
            🔄 Thông báo chuyển domain
          </h2>

          {/* Content */}
          <div className="text-center text-slate-600 space-y-3 mb-5">
            <p>
              Website đã chuyển sang địa chỉ mới:
            </p>
            <a
              href={newUrl}
              className="inline-block px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-colors"
            >
              {NEW_DOMAIN}
            </a>
            <p className="text-sm">
              Domain <span className="font-medium text-slate-700">{OLD_DOMAIN}</span> sẽ <span className="text-red-600 font-semibold">ngừng hoạt động</span> sau:
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <p className="text-red-700 font-bold text-lg">{countdown}</p>
              <p className="text-red-500 text-xs mt-1">Hạn chót: 0h ngày 11/04/2026</p>
            </div>
            <p className="text-xs text-slate-500">
              Vui lòng cập nhật bookmark và sử dụng domain mới để không bị gián đoạn.
            </p>
          </div>

          {/* Button */}
          <div className="flex flex-col gap-2">
            <a
              href={newUrl}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl text-center hover:bg-blue-700 transition-colors shadow-md"
            >
              Chuyển sang domain mới →
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default DomainMigrationBanner;
