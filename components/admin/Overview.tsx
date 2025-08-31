import React from 'react';

const data = [
  { name: 'Tháng 1', users: 12, tests: 20, avgScore: 78 },
  { name: 'Tháng 2', users: 19, tests: 32, avgScore: 82 },
  { name: 'Tháng 3', users: 25, tests: 45, avgScore: 85 },
];

const Overview: React.FC = () => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-slate-800">Tổng quan hệ thống</h3>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-600">Người dùng mới</h4>
              <p className="text-3xl font-bold text-blue-600">45</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">+12% so với tháng trước</p>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-600">Bài thi hoàn thành</h4>
              <p className="text-3xl font-bold text-green-600">120</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">+8% so với tháng trước</p>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-600">Điểm trung bình</h4>
              <p className="text-3xl font-bold text-yellow-600">84.5%</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">+2.3% so với tháng trước</p>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center">
            <div className="flex-1">
              <h4 className="font-semibold text-slate-600">Tổng bài thi</h4>
              <p className="text-3xl font-bold text-red-600">28</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">+5 bài mới tuần này</p>
        </div>
      </div>

      {/* Recent Activity & Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-lg shadow">
          <h4 className="font-semibold text-slate-700 mb-4">Hoạt động gần đây</h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">Admin đã tạo bài thi "Kiểm tra giữa kỳ"</p>
                <p className="text-xs text-slate-500">5 phút trước</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">User "student@example.com" hoàn thành bài thi</p>
                <p className="text-xs text-slate-500">15 phút trước</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">25 người dùng mới đăng ký hôm nay</p>
                <p className="text-xs text-slate-500">2 giờ trước</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow">
          <h4 className="font-semibold text-slate-700 mb-4">Thông báo hệ thống</h4>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
              <p className="text-sm font-medium text-blue-800">Hệ thống hoạt động bình thường</p>
              <p className="text-xs text-blue-600">Tất cả dịch vụ đang hoạt động ổn định</p>
            </div>
            <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <p className="text-sm font-medium text-yellow-800">Bảo trì định kỳ</p>
              <p className="text-xs text-yellow-600">Dự kiến bảo trì vào 2:00 AM ngày mai</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Chart without external library */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h4 className="font-semibold text-slate-700 mb-4">Thống kê theo tháng</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          {data.map((item, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <h5 className="font-semibold text-slate-600">{item.name}</h5>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Người dùng:</span>
                  <span className="font-semibold">{item.users}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Bài thi:</span>
                  <span className="font-semibold">{item.tests}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Điểm TB:</span>
                  <span className="font-semibold">{item.avgScore}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Overview;
