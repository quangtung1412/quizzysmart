import React from 'react';

interface PremiumIntroScreenProps {
    onLiveCameraStart: () => void;
    onBack: () => void;
}

const PremiumIntroScreen: React.FC<PremiumIntroScreenProps> = ({ onLiveCameraStart, onBack }) => {
    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-6 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
                    ✨ TÍNH NĂNG PREMIUM
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4">
                    Camera AI Thông Minh
                </h1>
                <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
                    Chụp ảnh câu hỏi trực tiếp, AI tự động nhận dạng và tìm đáp án chính xác trong cơ sở dữ liệu
                </p>
            </div>

            {/* Hero Image/Demo */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-8 mb-10 border-2 border-amber-200 shadow-xl">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1">
                        <div className="bg-white rounded-xl p-6 shadow-lg border border-amber-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Bật Camera</h3>
                                    <p className="text-sm text-slate-500">Chụp ảnh trực tiếp</p>
                                </div>
                            </div>
                            <div className="bg-slate-100 rounded-lg h-40 flex items-center justify-center border-2 border-dashed border-slate-300">
                                <span className="text-slate-400">📸 Ảnh câu hỏi</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-amber-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </div>

                    <div className="flex-1">
                        <div className="bg-white rounded-xl p-6 shadow-lg border border-green-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Kết quả</h3>
                                    <p className="text-sm text-slate-500">Đáp án chính xác</p>
                                </div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <p className="text-sm text-green-700 font-medium mb-2">✓ Câu hỏi được nhận dạng</p>
                                <p className="text-sm text-green-700 font-medium">✓ Đáp án đúng: <span className="font-bold">B</span></p>
                                <p className="text-xs text-green-600 mt-2">Độ tin cậy: 98%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 hover:shadow-lg transition-all">
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-blue-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Nhanh Chóng</h3>
                    <p className="text-slate-600 text-sm">
                        Nhận dạng và tìm đáp án trong vài giây. Tiết kiệm thời gian học tập hiệu quả.
                    </p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 hover:shadow-lg transition-all">
                    <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-purple-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Chính Xác</h3>
                    <p className="text-slate-600 text-sm">
                        Sử dụng AI tiên tiến để nhận dạng chính xác nội dung câu hỏi và các phương án.
                    </p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200 hover:shadow-lg transition-all">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-green-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Đáng Tin Cậy</h3>
                    <p className="text-slate-600 text-sm">
                        Tìm kiếm trong cơ sở dữ liệu của bạn, đảm bảo đáp án chính xác và đáng tin cậy.
                    </p>
                </div>
            </div>

            {/* How It Works */}
            <div className="bg-slate-50 rounded-2xl p-8 mb-10 border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Cách Sử Dụng</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                            1
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Bật Camera</h4>
                        <p className="text-sm text-slate-600">Mở camera trực tiếp trên thiết bị</p>
                    </div>

                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                            2
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Chụp ảnh</h4>
                        <p className="text-sm text-slate-600">Đưa câu hỏi vào khung hình và chụp</p>
                    </div>

                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                            3
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">AI xử lý</h4>
                        <p className="text-sm text-slate-600">AI nhận dạng và tìm đáp án</p>
                    </div>

                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-yellow-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                            4
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">Chụp tiếp</h4>
                        <p className="text-sm text-slate-600">Đóng popup và tiếp tục chụp câu khác</p>
                    </div>
                </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={onLiveCameraStart}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-5 px-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-lg flex items-center justify-center gap-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>📸 Bắt đầu với Camera</span>
                </button>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={onBack}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-8 rounded-xl transition-colors duration-200 min-h-[52px]"
                >
                    ← Quay lại
                </button>
            </div>

            {/* Note */}
            <div className="mt-8 text-center">
                <p className="text-sm text-slate-500">
                    💡 <strong>Lưu ý:</strong> Để có kết quả tốt nhất, hãy chụp ảnh rõ ràng với đủ ánh sáng và không bị mờ.
                </p>
            </div>
        </div>
    );
};

export default PremiumIntroScreen;
