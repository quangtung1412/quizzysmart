import React, { useState, useRef, useEffect } from 'react';
import { Question } from '../types';
import { api } from '../src/api';

interface ImageSearchScreenProps {
    onBack: () => void;
    knowledgeBases: Array<{ id: string; name: string }>;
    user: any;
}

interface SearchResult {
    recognizedText: string;
    matchedQuestion: Question | null;
    confidence: number;
    alternativeMatches?: Question[];
    ragResult?: {
        answer: string;
        confidence: number;
        sources?: Array<{
            documentName: string;
            documentNumber?: string;
            score: number;
        }>;
        model?: string;
        chunksUsed?: number;
    };
    searchType?: string;
    extractedOptions?: {
        A?: string;
        B?: string;
        C?: string;
        D?: string;
    };
}

const ImageSearchScreen: React.FC<ImageSearchScreenProps> = ({ onBack, knowledgeBases, user }) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Automatically use all knowledge bases
    const allKnowledgeBaseIds = knowledgeBases.map(kb => kb.id);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        // Check if user is logged in
        if (!user) {
            setError('Vui lòng đăng nhập để sử dụng tính năng này.');
            return;
        }

        try {
            setIsCameraLoading(true);
            setError(null);

            console.log('Requesting camera access...');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            console.log('Camera stream obtained:', stream);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;

                // Wait for video to be ready
                videoRef.current.onloadedmetadata = () => {
                    console.log('Video metadata loaded');
                    setIsCameraActive(true);
                    setIsCameraLoading(false);
                };

                setError(null);
                setSearchResult(null);
            }
        } catch (err: any) {
            console.error('Camera error:', err);
            setIsCameraLoading(false);
            setError(`Không thể truy cập camera: ${err.message || 'Vui lòng cho phép quyền truy cập camera.'}`);
        }
    }; const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setIsCameraLoading(false);
    };

    const captureAndSearch = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsProcessing(true);
        setError(null);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;

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

                // Stop camera while searching
                stopCamera();

                // Set captured image for preview
                setSelectedImage(imageDataUrl);

                // Search in all knowledge bases
                const result: SearchResult = await api.searchByImage(base64Image, allKnowledgeBaseIds);
                setSearchResult(result);
            }
        } catch (err: any) {
            console.error('Capture and search error:', err);
            setError(err.message || 'Không thể xử lý ảnh');
        } finally {
            setIsProcessing(false);
        }
    };

    const closeResultAndContinue = () => {
        setSearchResult(null);
        setSelectedImage(null);
        setError(null);
        // Restart camera when closing popup
        startCamera();
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSelectedImage(e.target?.result as string);
                setSearchResult(null);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSearch = async () => {
        if (!selectedImage) {
            setError('Vui lòng chọn ảnh để tìm kiếm');
            return;
        }

        // Check if user is logged in
        if (!user) {
            setError('Vui lòng đăng nhập để sử dụng tính năng này.');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // Remove data:image prefix to get base64 string
            const base64Image = selectedImage.split(',')[1];

            // Search in all knowledge bases
            const result: SearchResult = await api.searchByImage(base64Image, allKnowledgeBaseIds);
            setSearchResult(result);
        } catch (err: any) {
            console.error('Search error:', err);
            setError(err.message || 'Không thể kết nối đến server');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setSelectedImage(null);
        setSearchResult(null);
        setError(null);
        stopCamera();
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-8">
            {/* Header - Mobile Optimized */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">🤖 AI Trợ Lý</h1>
                            <p className="text-xs sm:text-sm text-slate-600 mt-1">Chụp ảnh để tìm đáp án nhanh</p>
                        </div>
                        <button
                            onClick={onBack}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-3 sm:px-4 rounded-lg transition-colors min-h-[44px] text-sm sm:text-base"
                        >
                            ← Quay lại
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Main Content */}
                <div className="space-y-4">
                    {/* Camera Loading */}
                    {isCameraLoading && (
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-8 text-center">
                            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-blue-800 font-semibold">Đang mở camera...</p>
                            <p className="text-blue-600 text-sm mt-2">Vui lòng cho phép quyền truy cập camera</p>
                        </div>
                    )}

                    {/* Camera View - Active */}
                    {isCameraActive && !isCameraLoading && (
                        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-blue-500 relative min-h-[400px]">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-auto min-h-[400px] object-cover"
                            />
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Camera Controls Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={stopCamera}
                                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg min-h-[48px]"
                                        disabled={isProcessing}
                                    >
                                        ✕ Hủy
                                    </button>
                                    <button
                                        onClick={captureAndSearch}
                                        disabled={isProcessing}
                                        className={`font-bold py-4 px-8 rounded-xl transition-all shadow-lg min-h-[56px] ${isProcessing
                                            ? 'bg-slate-500 cursor-not-allowed text-white'
                                            : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                                            }`}
                                    >
                                        {isProcessing ? (
                                            <span className="flex items-center gap-2">
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Đang xử lý...
                                            </span>
                                        ) : (
                                            '📸 Chụp & Tìm kiếm'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Upload Section - Mobile Optimized */}
                    {!isCameraActive && !isCameraLoading && (
                        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-200">
                            {!selectedImage ? (
                                <div className="space-y-3">
                                    <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3">📸 Chọn ảnh câu hỏi</h3>

                                    {/* Camera Button - Prominent for mobile */}
                                    <button
                                        onClick={() => {
                                            console.log('Camera button clicked');
                                            startCamera();
                                        }}
                                        disabled={isCameraLoading}
                                        className={`w-full font-bold py-5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 min-h-[64px] text-lg ${isCameraLoading
                                            ? 'bg-slate-400 cursor-not-allowed text-white'
                                            : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                                            }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                        </svg>
                                        <span>Chụp ảnh ngay</span>
                                    </button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-slate-300"></div>
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="px-2 bg-white text-slate-500">hoặc</span>
                                        </div>
                                    </div>

                                    {/* Upload Button */}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 px-6 rounded-xl transition-colors duration-200 border-2 border-dashed border-slate-300 hover:border-slate-400 flex items-center justify-center gap-3 min-h-[56px]"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                        </svg>
                                        <span>Chọn từ thư viện</span>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        aria-label="Chọn ảnh từ thư viện"
                                    />

                                    {/* Info badge */}
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs sm:text-sm text-blue-800 text-center">
                                            💡 Tự động tìm kiếm trong toàn bộ {knowledgeBases.length} nguồn kiến thức
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 shadow-md">
                                        <img src={selectedImage} alt="Selected" className="w-full h-auto max-h-96 object-contain bg-slate-50" />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleReset}
                                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors min-h-[48px]"
                                        >
                                            🔄 Chọn ảnh khác
                                        </button>
                                        <button
                                            onClick={handleSearch}
                                            disabled={isProcessing}
                                            className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all min-h-[48px] shadow-lg ${isProcessing
                                                ? 'bg-slate-400 cursor-not-allowed text-white'
                                                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-xl'
                                                }`}
                                        >
                                            {isProcessing ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Đang tìm...
                                                </span>
                                            ) : (
                                                '🔍 Tìm đáp án'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Display - Only show if not in camera mode */}
                    {error && !isCameraActive && (
                        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-shake">
                            <div className="flex items-start gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <h4 className="font-bold text-red-800 text-sm sm:text-base">⚠️ Lỗi</h4>
                                    <p className="text-red-700 text-xs sm:text-sm mt-1">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results for non-camera mode */}
                    {!isCameraActive && searchResult && (
                        <div className="space-y-4">
                            {/* Recognized Text */}
                            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-sm sm:text-base">
                                    📝 Văn bản nhận dạng
                                </h4>
                                <p className="text-blue-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{searchResult.recognizedText}</p>
                            </div>

                            {/* Matched Question */}
                            {searchResult.matchedQuestion ? (
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 sm:p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <h4 className="font-bold text-green-900 flex items-center gap-2 text-base sm:text-lg">
                                            ✅ Đã tìm thấy!
                                        </h4>
                                        <span className="bg-green-200 text-green-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                                            {Math.round(searchResult.confidence)}% khớp
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="bg-white/50 rounded-lg p-3">
                                            <p className="font-semibold text-green-900 text-sm sm:text-base leading-relaxed">
                                                {searchResult.matchedQuestion.question}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            {searchResult.matchedQuestion.options.map((option, index) => (
                                                <div
                                                    key={index}
                                                    className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${index === searchResult.matchedQuestion!.correctAnswerIndex
                                                        ? 'bg-green-200 border-green-500 shadow-md scale-[1.02]'
                                                        : 'bg-white border-green-200'
                                                        }`}
                                                >
                                                    <span className={`text-sm sm:text-base block ${index === searchResult.matchedQuestion!.correctAnswerIndex
                                                        ? 'font-bold text-green-900'
                                                        : 'text-slate-800'
                                                        }`}>
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
                                </div>
                            ) : searchResult.ragResult ? (
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-4 sm:p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <h4 className="font-bold text-purple-900 flex items-center gap-2 text-base sm:text-lg">
                                            🤖 Câu trả lời từ AI
                                        </h4>
                                        <span className="bg-purple-200 text-purple-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                                            {Math.round(searchResult.ragResult.confidence)}% độ tin cậy
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
                                            <p className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                                                {searchResult.ragResult.answer}
                                            </p>
                                        </div>

                                        {searchResult.ragResult.sources && searchResult.ragResult.sources.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-purple-200">
                                                <p className="text-xs sm:text-sm text-purple-800 font-semibold mb-2">
                                                    📚 Nguồn tài liệu ({searchResult.ragResult.sources.length}):
                                                </p>
                                                <div className="space-y-1.5">
                                                    {searchResult.ragResult.sources.slice(0, 3).map((source, idx) => (
                                                        <div key={idx} className="bg-purple-100/50 rounded px-3 py-2">
                                                            <p className="text-xs text-purple-900">
                                                                <span className="font-bold">[{idx + 1}]</span> {source.documentName}
                                                                {source.documentNumber && ` (${source.documentNumber})`}
                                                                <span className="ml-2 text-purple-600">• {Math.round(source.score * 100)}%</span>
                                                            </p>
                                                        </div>
                                                    ))}
                                                    {searchResult.ragResult.sources.length > 3 && (
                                                        <p className="text-xs text-purple-700 italic pl-3">
                                                            + {searchResult.ragResult.sources.length - 3} nguồn khác...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {searchResult.ragResult.model && (
                                            <p className="text-xs text-purple-600 italic mt-2">
                                                Model: {searchResult.ragResult.model}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">😕</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-yellow-900 mb-2 text-sm sm:text-base">Không tìm thấy kết quả</h4>
                                            <p className="text-yellow-800 text-xs sm:text-sm mb-3">
                                                Không tìm thấy câu hỏi tương tự trong {knowledgeBases.length} nguồn kiến thức.
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
                        </div>
                    )}
                </div>
            </div>

            {/* Camera Mode: Results Popup Overlay */}
            {isCameraActive && searchResult && (
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
                            {/* Recognized Text */}
                            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 sm:p-6 mb-4">
                                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                                    <span className="text-xl">🔍</span>
                                    Câu hỏi được nhận dạng:
                                </h4>
                                <p className="text-blue-800 leading-relaxed text-xs sm:text-sm whitespace-pre-wrap">
                                    {searchResult.recognizedText}
                                </p>
                            </div>

                            {/* Matched Question or No Results */}
                            {searchResult.matchedQuestion ? (
                                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3 mb-4">
                                        <span className="text-2xl flex-shrink-0">✅</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-green-900 text-sm sm:text-base">Tìm thấy câu hỏi tương tự!</h4>
                                            <p className="text-green-700 text-xs mt-1">
                                                Độ chính xác: <span className="font-bold">{searchResult.matchedQuestion.accuracy}%</span>
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
                                        {searchResult.matchedQuestion.answers.map((option, index) => (
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
                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <h4 className="font-bold text-purple-900 flex items-center gap-2 text-sm sm:text-base">
                                            🤖 Câu trả lời từ AI
                                        </h4>
                                        <span className="bg-purple-200 text-purple-900 px-3 py-1.5 rounded-full text-xs font-bold">
                                            {Math.round(searchResult.ragResult.confidence)}% độ tin cậy
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
                                            <p className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                                                {searchResult.ragResult.answer}
                                            </p>
                                        </div>

                                        {searchResult.ragResult.sources && searchResult.ragResult.sources.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-purple-200">
                                                <p className="text-xs text-purple-800 font-semibold mb-2">
                                                    📚 Nguồn tài liệu ({searchResult.ragResult.sources.length}):
                                                </p>
                                                <div className="space-y-1.5">
                                                    {searchResult.ragResult.sources.slice(0, 3).map((source, idx) => (
                                                        <div key={idx} className="bg-purple-100/50 rounded px-2 py-1.5">
                                                            <p className="text-xs text-purple-900">
                                                                <span className="font-bold">[{idx + 1}]</span> {source.documentName}
                                                                {source.documentNumber && ` (${source.documentNumber})`}
                                                                <span className="ml-2 text-purple-600">• {Math.round(source.score * 100)}%</span>
                                                            </p>
                                                        </div>
                                                    ))}
                                                    {searchResult.ragResult.sources.length > 3 && (
                                                        <p className="text-xs text-purple-700 italic pl-2">
                                                            + {searchResult.ragResult.sources.length - 3} nguồn khác...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {searchResult.ragResult.model && (
                                            <p className="text-xs text-purple-600 italic mt-2">
                                                Model: {searchResult.ragResult.model}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">😕</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-yellow-900 mb-2 text-sm sm:text-base">Không tìm thấy kết quả</h4>
                                            <p className="text-yellow-800 text-xs sm:text-sm mb-3">
                                                Không tìm thấy câu hỏi tương tự trong {knowledgeBases.length} nguồn kiến thức.
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
        </div>
    );
};

export default ImageSearchScreen;
