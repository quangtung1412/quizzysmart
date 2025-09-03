import React from 'react';

interface ModeSelectionScreenProps {
  onSelectPracticeMode: () => void;
  onSelectTestMode: () => void;
  userName: string;
}

const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({
  onSelectPracticeMode,
  onSelectTestMode,
  userName
}) => {
  return (
    <div className="max-w-4xl mx-auto text-center space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-700 mb-3 sm:mb-4">
          Chào mừng, {userName}!
        </h2>
        <p className="text-base sm:text-lg text-slate-600">
          Chọn chế độ học tập phù hợp với bạn
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
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
              <h3 className="text-xl sm:text-2xl font-bold text-green-700 mb-2 sm:mb-3">Ôn luyện</h3>
              <p className="text-green-600 text-sm sm:text-base mb-3 sm:mb-4">
                Luyện tập với các bộ câu hỏi có sẵn
              </p>
              <ul className="text-xs sm:text-sm text-green-600 space-y-1.5 sm:space-y-2 text-left">
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
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Lưu lại lịch sử làm bài</span>
                </li>
              </ul>
            </div>
            <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-colors duration-200 group-hover:bg-green-600 text-sm sm:text-base min-h-[44px]">
              Bắt đầu ôn luyện
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
              <h3 className="text-xl sm:text-2xl font-bold text-blue-700 mb-2 sm:mb-3">Thi</h3>
              <p className="text-blue-600 text-sm sm:text-base mb-3 sm:mb-4">
                Làm bài thi được phân công chính thức
              </p>
              <ul className="text-xs sm:text-sm text-blue-600 space-y-1.5 sm:space-y-2 text-left">
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
                <li className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Lưu kết quả vĩnh viễn</span>
                </li>
              </ul>
            </div>
            <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl transition-colors duration-200 group-hover:bg-blue-600 text-sm sm:text-base min-h-[44px]">
              Vào thi
            </button>
          </div>
        </div>

      </div>

      <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-slate-100 rounded-lg">
        <p className="text-xs sm:text-sm text-slate-600">
          💡 <strong>Gợi ý:</strong> Bắt đầu với <span className="text-green-600 font-semibold">Ôn luyện</span> để làm quen câu hỏi, sau đó thử sức với chế độ <span className="text-blue-600 font-semibold">Thi</span>.
        </p>
      </div>
    </div>
  );
};

export default ModeSelectionScreen;
