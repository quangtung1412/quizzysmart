import React, { useState, lazy, Suspense } from 'react';

const ChatModal = lazy(() => import('./ChatModal'));

const ChatFloatingButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  console.log('[ChatFloatingButton] Component mounted');

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-purple-300 group"
        aria-label="Mở trợ lý AI"
      >
        {/* Chat Icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
          />
        </svg>
        
        {/* Pulse Effect */}
        <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
        </span>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <ChatModal onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default ChatFloatingButton;
