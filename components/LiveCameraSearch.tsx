import React, { useState, useRef, useEffect } from 'react';
import { Question } from '../types';
import { api } from '../src/api';

interface LiveCameraSearchProps {
    onBack: () => void;
    onGoToPremiumPlans: () => void;
    knowledgeBases: Array<{ id: string; name: string }>;
    user: any;
}

interface SearchResult {
    recognizedText: string;
    matchedQuestion: Question | null;
    confidence: number;
    modelUsed?: string;
    modelPriority?: number;
}

const LiveCameraSearch: React.FC<LiveCameraSearchProps> = ({ onBack, onGoToPremiumPlans, knowledgeBases, user }) => {
    const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);
    const [isStreamActive, setIsStreamActive] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(true);
    const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [remainingQuota, setRemainingQuota] = useState<number>(user?.aiSearchQuota || 0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Update quota when user prop changes
    useEffect(() => {
        if (user?.aiSearchQuota !== undefined) {
            setRemainingQuota(user.aiSearchQuota);
        }
    }, [user?.aiSearchQuota]);

    // Start camera stream
    const startCamera = async () => {
        // Check if user is logged in
        if (!user) {
            setError('Vui lòng đăng nhập để sử dụng tính năng này.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setIsStreamActive(true);
                setError(null);
                setShowSettings(false);
            }
        } catch (err) {
            console.error('Camera error:', err);
            setError('Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.');
        }
    };

    // Stop camera stream
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsStreamActive(false);
    };

    // Capture frame and search
    const captureAndSearch = async () => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;

        // Throttle captures (minimum 2 seconds between captures)
        const now = Date.now();
        if (now - lastCaptureTime < 2000) return;
        setLastCaptureTime(now);

        if (selectedKnowledgeBases.length === 0) {
            setError('Vui lòng chọn ít nhất một cơ sở kiến thức');
            return;
        }

        // Check quota for non-admin users
        if (user?.role !== 'admin' && remainingQuota <= 0) {
            // Redirect to premium plans screen
            stopCamera();
            onGoToPremiumPlans();
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const canvas = canvasRef.current;
            const video = videoRef.current;

            // Set canvas size to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current video frame to canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert canvas to base64
                const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const base64Image = imageDataUrl.split(',')[1];

                // Save captured image for display
                setCapturedImage(imageDataUrl);

                // Stop camera while searching
                stopCamera();

                // Send to API using the centralized api.ts
                const result: any = await api.searchByImage(base64Image, selectedKnowledgeBases);
                setSearchResult(result);

                // Update remaining quota if provided
                if (result.remainingQuota !== undefined) {
                    setRemainingQuota(result.remainingQuota);
                }
            }
        } catch (err: any) {
            console.error('Search error:', err);
            setError(err.message || 'Không thể kết nối đến server');
        } finally {
            setIsProcessing(false);
        }
    };

    // Close result popup and restart camera
    const closeResultAndContinue = () => {
        setSearchResult(null);
        setError(null);
        setCapturedImage(null); // Clear captured image
        // Restart camera
        startCamera();
    };

    // Handle knowledge base toggle
    const handleKnowledgeBaseToggle = (baseId: string) => {
        setSelectedKnowledgeBases(prev =>
            prev.includes(baseId)
                ? prev.filter(id => id !== baseId)
                : [...prev, baseId]
        );
    };

    const handleSelectAll = () => {
        if (selectedKnowledgeBases.length === knowledgeBases.length) {
            setSelectedKnowledgeBases([]);
        } else {
            setSelectedKnowledgeBases(knowledgeBases.map(kb => kb.id));
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            stopCamera();
                            onBack();
                        }}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        aria-label="Quay lại"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">Camera Tìm Đáp Án</h1>
                        <p className="text-xs text-white/80">
                            {user?.role === 'admin' ? (
                                'Không giới hạn lượt tìm kiếm'
                            ) : (
                                `Còn ${remainingQuota} lượt tìm kiếm`
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Cài đặt"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden">
                {/* Video Stream or Captured Image */}
                {capturedImage ? (
                    <img
                        src={capturedImage}
                        alt="Captured frame"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {/* Hidden canvas for capturing frames */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Settings Overlay */}
                {showSettings && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
                            <h3 className="text-xl font-bold text-slate-800">Cài đặt</h3>

                            {/* Knowledge Base Selection */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="font-medium text-slate-700">Chọn nguồn tìm kiếm</label>
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        {selectedKnowledgeBases.length === knowledgeBases.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {knowledgeBases.map((kb) => (
                                        <label
                                            key={kb.id}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedKnowledgeBases.includes(kb.id)}
                                                onChange={() => handleKnowledgeBaseToggle(kb.id)}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-slate-700">{kb.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {selectedKnowledgeBases.length > 0 && (
                                    <p className="text-sm text-slate-600 mt-2">
                                        Đã chọn {selectedKnowledgeBases.length}/{knowledgeBases.length} nguồn
                                    </p>
                                )}
                            </div>

                            {/* Start Button */}
                            <button
                                onClick={startCamera}
                                disabled={selectedKnowledgeBases.length === 0}
                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg"
                            >
                                {isStreamActive ? 'Bắt đầu lại' : 'Bắt đầu'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Processing Indicator */}
                {isProcessing && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">Đang xử lý...</span>
                    </div>
                )}

                {/* Model Info (if available) */}
                {searchResult?.modelUsed && (
                    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white px-3 py-1 rounded-full shadow-lg text-xs">
                        AI Model: {searchResult.modelUsed} (P{searchResult.modelPriority})
                    </div>
                )}

                {/* Error Message */}
                {error && !showSettings && (
                    <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg">
                        <p className="font-medium">{error}</p>
                    </div>
                )}
            </div>

            {/* Results Popup Modal */}
            {searchResult && !showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
                        {/* Close Button */}
                        <button
                            onClick={closeResultAndContinue}
                            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors shadow-md"
                            aria-label="Đóng"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Popup Content */}
                        <div className="p-6 pt-14">
                            {searchResult.matchedQuestion ? (
                                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3 mb-4">
                                        <span className="text-2xl flex-shrink-0">✅</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-green-900 text-sm sm:text-base">Tìm thấy câu hỏi!</h4>
                                            <p className="text-green-700 text-xs mt-1">
                                                Độ chính xác: <span className="font-bold">{Math.round(searchResult.confidence)}%</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Question */}
                                    <div className="bg-white rounded-lg p-3 sm:p-4 mb-3">
                                        <p className="text-gray-800 font-medium text-xs sm:text-sm leading-relaxed">
                                            {searchResult.matchedQuestion.question}
                                        </p>
                                    </div>

                                    {/* Answers */}
                                    <div className="space-y-2">
                                        {searchResult.matchedQuestion.options.map((option, index) => (
                                            <div
                                                key={index}
                                                className={`rounded-lg p-3 text-xs sm:text-sm ${index === searchResult.matchedQuestion!.correctAnswerIndex
                                                    ? 'bg-green-100 border-2 border-green-400 font-semibold'
                                                    : 'bg-gray-50 border border-gray-200'
                                                    }`}
                                            >
                                                <span className="flex items-start gap-2">
                                                    <span className="inline-block w-6 font-bold">{String.fromCharCode(65 + index)}.</span>
                                                    {option}
                                                    {index === searchResult.matchedQuestion!.correctAnswerIndex && (
                                                        <span className="ml-2 text-green-600 font-bold">✓</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {searchResult.matchedQuestion.source && (
                                        <div className="mt-3 pt-3 border-t border-green-200">
                                            <p className="text-xs sm:text-sm text-green-800">
                                                <strong>📚 Nguồn:</strong> {searchResult.matchedQuestion.source}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">😕</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-yellow-900 mb-2 text-sm sm:text-base">Không tìm thấy kết quả</h4>
                                            <p className="text-yellow-800 text-xs sm:text-sm mb-3">
                                                Không tìm thấy câu hỏi tương tự trong {selectedKnowledgeBases.length} nguồn kiến thức đã chọn.
                                            </p>
                                            <div className="bg-yellow-100/50 rounded-lg p-3">
                                                <p className="text-yellow-800 font-semibold text-xs sm:text-sm mb-2">💡 Gợi ý:</p>
                                                <ul className="text-yellow-800 text-xs sm:text-sm space-y-1 list-disc list-inside">
                                                    <li>Chụp ảnh rõ hơn, đủ ánh sáng</li>
                                                    <li>Đảm bảo câu hỏi nằm trong khung hình</li>
                                                    <li>Kiểm tra câu hỏi có trong dữ liệu chưa</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Continue Button */}
                            <button
                                onClick={closeResultAndContinue}
                                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
                            >
                                📸 Tiếp tục chụp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Control Bar */}
            {isStreamActive && !showSettings && (
                <div className="bg-black/90 p-6 flex items-center justify-center gap-4">
                    <button
                        onClick={captureAndSearch}
                        disabled={isProcessing}
                        className="w-20 h-20 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                        aria-label="Chụp và tìm kiếm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-10 h-10">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default LiveCameraSearch;
