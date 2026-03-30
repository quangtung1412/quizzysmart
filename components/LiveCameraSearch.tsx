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
    extractedOptions?: {
        A: string;
        B: string;
        C: string;
        D: string;
    };
    matchedQuestion: Question | null;
    confidence: number;
    searchType: 'database' | 'rag-only' | 'database+rag';
    ragResult?: {
        answer: string | {
            correctAnswer: string;
            options: {
                A: string;
                B: string;
                C: string;
                D: string;
            };
            explanation: string;
            source: string;
            confidence: number;
        };
        confidence: number;
        sources: Array<{
            documentName: string;
            content: string;
            score: number;
        }>;
        model: string;
        structured?: boolean;
    };
    modelUsed?: string;
    modelPriority?: number;
    ragRestricted?: boolean;
    ragRestrictedMessage?: string;
}

const LiveCameraSearch: React.FC<LiveCameraSearchProps> = ({ onBack, onGoToPremiumPlans, knowledgeBases, user }) => {
    const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<string[]>([]);
    const [isStreamActive, setIsStreamActive] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false); // Start with camera directly
    const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [remainingQuota, setRemainingQuota] = useState<number>(user?.aiSearchQuota || 0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Function to get confidence color based on percentage
    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'text-green-600' };
        if (confidence >= 60) return { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', badge: 'text-yellow-600' };
        if (confidence >= 40) return { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'text-orange-600' };
        return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'text-red-600' };
    };

    // Update quota when user prop changes
    useEffect(() => {
        if (user?.aiSearchQuota !== undefined) {
            setRemainingQuota(user.aiSearchQuota);
        }
    }, [user?.aiSearchQuota]);

    // Auto-start camera and set all knowledge bases when component mounts
    useEffect(() => {
        // Set all knowledge bases as selected by default
        const allKnowledgeBaseIds = knowledgeBases.map(kb => kb.id);
        setSelectedKnowledgeBases(allKnowledgeBaseIds);

        // Auto-start camera
        if (user) {
            startCamera();
        }
    }, [knowledgeBases, user]);

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

        // Use all knowledge bases if none are specifically selected
        const knowledgeBasesToSearch = selectedKnowledgeBases.length === 0
            ? knowledgeBases.map(kb => kb.id)
            : selectedKnowledgeBases;

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

                // Send to API using the centralized api.ts with all questions from DB
                const result: any = await api.searchByImage(base64Image, knowledgeBasesToSearch);
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
                                                {searchResult.searchType === 'database+rag' && (
                                                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                        + RAG hỗ trợ
                                                    </span>
                                                )}
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
                            ) : searchResult.ragResult ? (
                                (() => {
                                    const confidence = Math.round(searchResult.ragResult.confidence);
                                    const colorScheme = getConfidenceColor(confidence);
                                    const structuredAnswer = typeof searchResult.ragResult.answer === 'object' ? searchResult.ragResult.answer : null;
                                    const correctAnswerLetter = structuredAnswer?.correctAnswer;
                                    const isAnswerNotFound = correctAnswerLetter === 'NONE' || correctAnswerLetter === 'none';

                                    return (
                                        <div className={`${colorScheme.bg} border-2 ${colorScheme.border} rounded-xl p-4 sm:p-6`}>
                                            <div className="flex items-start gap-3 mb-4">
                                                <span className="text-2xl flex-shrink-0">🤖</span>
                                                <div className="flex-1">
                                                    <h4 className={`font-bold ${colorScheme.text} text-sm sm:text-base`}>AI Assistant</h4>
                                                    <p className={`${colorScheme.text} text-xs mt-1`}>
                                                        Độ tin cậy: <span className={`font-bold ${colorScheme.badge}`}>{confidence}%</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Display question from extracted text */}
                                            <div className="bg-white rounded-lg p-3 sm:p-4 mb-3 border-l-4 border-blue-500">
                                                <h5 className="font-semibold text-gray-900 mb-2">❓ Câu hỏi:</h5>
                                                <div className="text-gray-800 text-xs sm:text-sm leading-relaxed">
                                                    {searchResult.recognizedText}
                                                </div>
                                            </div>

                                            {/* Show "answer not found" message when AI returns NONE */}
                                            {isAnswerNotFound ? (
                                                <div className="bg-orange-50 rounded-lg p-3 sm:p-4 mb-3 border-l-4 border-orange-400">
                                                    <h5 className="font-semibold text-orange-800 mb-2">⚠️ Không tìm thấy đáp án</h5>
                                                    <p className="text-orange-700 text-xs sm:text-sm leading-relaxed">
                                                        AI không thể xác định đáp án đúng trong các lựa chọn có sẵn dựa trên tài liệu tham khảo.
                                                    </p>
                                                    {structuredAnswer?.explanation && (
                                                        <p className="text-orange-600 text-xs mt-2 italic">
                                                            {structuredAnswer.explanation}
                                                        </p>
                                                    )}
                                                    {/* Still show extracted options without highlighting */}
                                                    {searchResult.extractedOptions && (
                                                        <div className="mt-3 space-y-2">
                                                            {Object.entries(searchResult.extractedOptions).map(([key, value]) => (
                                                                <div key={key} className="p-2 rounded-lg border bg-gray-50 border-gray-300 text-gray-700 text-xs sm:text-sm">
                                                                    <span className="font-bold">{key}.</span> {value}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : searchResult.extractedOptions ? (
                                                <div className="bg-white rounded-lg p-3 sm:p-4 mb-3">
                                                    <h5 className="font-semibold text-gray-900 mb-3">📝 Đáp án:</h5>
                                                    <div className="space-y-2">
                                                        {Object.entries(searchResult.extractedOptions).map(([key, value]) => (
                                                            <div
                                                                key={key}
                                                                className={`p-2 rounded-lg border text-xs sm:text-sm ${key === correctAnswerLetter
                                                                    ? 'bg-green-100 border-green-500 text-green-800 font-semibold'
                                                                    : 'bg-gray-50 border-gray-300 text-gray-700'
                                                                    }`}
                                                            >
                                                                <span className="font-bold">{key}.</span> {value}
                                                                {key === correctAnswerLetter && (
                                                                    <span className="ml-2 text-green-600 font-bold">✓</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Fallback: if no extracted options, show AI response directly */
                                                <div className="bg-white rounded-lg p-3 sm:p-4 mb-3">
                                                    <h5 className="font-semibold text-gray-900 mb-2">💡 Câu trả lời AI:</h5>
                                                    <div className="text-gray-800 text-xs sm:text-sm leading-relaxed">
                                                        {typeof searchResult.ragResult.answer === 'string' ?
                                                            searchResult.ragResult.answer :
                                                            structuredAnswer?.correctAnswer || 'Không xác định được đáp án'}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Source information */}
                                            {structuredAnswer?.source && !isAnswerNotFound && (
                                                <div className="bg-white rounded-lg p-2 mt-3">
                                                    <p className="text-xs text-gray-600">
                                                        <span className="font-medium">📋 Nguồn:</span> {structuredAnswer.source}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Content summary from sources */}
                                            {!isAnswerNotFound && searchResult.ragResult.sources && searchResult.ragResult.sources.length > 0 && (
                                                <div className="bg-white rounded-lg p-3 mt-3">
                                                    <h6 className="font-medium text-gray-900 mb-2">📄 Tóm tắt nội dung liên quan:</h6>
                                                    <div className="text-xs text-gray-700 leading-relaxed">
                                                        {structuredAnswer?.explanation ? (
                                                            structuredAnswer.explanation
                                                        ) : (
                                                            (() => {
                                                                const mainSource = searchResult.ragResult.sources[0];
                                                                if (!mainSource) return "Không có thông tin chi tiết.";

                                                                const content = mainSource.content;
                                                                const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
                                                                const summary = sentences.slice(0, 2).join('. ').trim();

                                                                return summary.length > 200
                                                                    ? summary.substring(0, 200) + '...'
                                                                    : summary + (summary.endsWith('.') ? '' : '.');
                                                            })()
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Disclaimer */}
                                            <div className="mt-4 pt-3 border-t border-gray-200">
                                                <p className="text-xs text-gray-500 italic flex items-start gap-1.5">
                                                    <span className="flex-shrink-0">⚠️</span>
                                                    <span>AI có thể mắc sai lầm. Kết quả chỉ mang tính tham khảo, vui lòng kiểm tra lại thông tin từ nguồn gốc trước khi sử dụng.</span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (searchResult as any).ragRestricted ? (
                                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl flex-shrink-0">🔒</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-amber-900 mb-2 text-sm sm:text-base">Không tìm thấy trong ngân hàng câu hỏi</h4>
                                            <p className="text-amber-800 text-xs sm:text-sm mb-3">
                                                {(searchResult as any).ragRestrictedMessage || 'Tính năng tìm kiếm AI nâng cao trong văn bản quy định chỉ dành cho gói Premium và MAX.'}
                                            </p>
                                            <div className="bg-amber-100/60 rounded-lg p-3 mb-3">
                                                <p className="text-amber-800 font-semibold text-xs sm:text-sm mb-2">✨ Với gói Premium/MAX, bạn sẽ có:</p>
                                                <ul className="text-amber-800 text-xs sm:text-sm space-y-1 list-disc list-inside">
                                                    <li>AI tìm kiếm trong hàng nghìn trang văn bản quy định</li>
                                                    <li>Câu trả lời kèm trích dẫn nguồn tài liệu</li>
                                                    <li>Độ chính xác cao với công nghệ RAG</li>
                                                </ul>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    closeResultAndContinue();
                                                    onGoToPremiumPlans();
                                                }}
                                                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                                            >
                                                ⭐ Nâng cấp ngay
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">😕</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-yellow-900 mb-2 text-sm sm:text-base">Không tìm thấy kết quả</h4>
                                            <p className="text-yellow-800 text-xs sm:text-sm mb-3">
                                                Không tìm thấy câu hỏi tương tự trong cơ sở dữ liệu và cũng không tìm thấy thông tin liên quan trong tài liệu RAG.
                                            </p>
                                            <div className="bg-yellow-100/50 rounded-lg p-3">
                                                <p className="text-yellow-800 font-semibold text-xs sm:text-sm mb-2">💡 Gợi ý:</p>
                                                <ul className="text-yellow-800 text-xs sm:text-sm space-y-1 list-disc list-inside">
                                                    <li>Chụp ảnh rõ hơn, đủ ánh sáng</li>
                                                    <li>Đảm bảo câu hỏi nằm trong khung hình</li>
                                                    <li>Kiểm tra câu hỏi có trong dữ liệu chưa</li>
                                                    <li>Thử chọn thêm nguồn kiến thức khác</li>
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
