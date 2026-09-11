import React, { useState } from 'react';
import { SearchTimeline } from '../types';

interface SearchTimelineViewProps {
    timeline: SearchTimeline;
    modelUsed?: string;
}

export const SearchTimelineView: React.FC<SearchTimelineViewProps> = ({ timeline, modelUsed }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const totalMs = timeline.clientTotalMs || timeline.serverTotalMs || 1;
    const totalSeconds = (totalMs / 1000).toFixed(2);

    // Xác định màu sắc đánh giá tổng thời gian
    const getBadgeStyle = (ms: number) => {
        if (ms < 2500) {
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        }
        if (ms <= 5000) {
            return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
        }
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    };

    // Chuẩn bị danh sách các công đoạn
    const stages: Array<{
        key: string;
        label: string;
        ms: number;
        icon: string;
        color: string;
        note?: string;
    }> = [
        ...(timeline.clientCaptureMs !== undefined ? [{
            key: 'clientCapture',
            label: 'Chụp & nén frame ảnh (Client)',
            ms: timeline.clientCaptureMs,
            icon: '📸',
            color: 'bg-blue-500',
            note: 'Vẽ canvas & xuất Base64'
        }] : []),
        ...(timeline.networkTransferMs !== undefined ? [{
            key: 'network',
            label: 'Truyền tải mạng 2 chiều (Network)',
            ms: timeline.networkTransferMs,
            icon: '🌐',
            color: 'bg-cyan-500',
            note: 'Upload ảnh & tải phản hồi'
        }] : []),
        {
            key: 'auth',
            label: 'Khởi tạo & kiểm tra Quota (Server)',
            ms: timeline.serverAuthMs,
            icon: '🔑',
            color: 'bg-slate-400',
            note: 'Auth, quota & chọn model'
        },
        {
            key: 'ocr',
            label: 'Gemini Vision OCR (Bóc tách ảnh)',
            ms: timeline.visionOcrMs,
            icon: '🤖',
            color: 'bg-indigo-500',
            note: modelUsed ? `Model: ${modelUsed}` : undefined
        },
        {
            key: 'dbQuery',
            label: 'Truy vấn CSDL câu hỏi (Prisma DB)',
            ms: timeline.dbQueryMs,
            icon: '🗄️',
            color: 'bg-teal-500',
            note: 'Lấy danh sách đề thi'
        },
        {
            key: 'dbMatch',
            label: 'So khớp câu hỏi & căn chỉnh đáp án',
            ms: timeline.dbMatchMs,
            icon: '🔍',
            color: 'bg-violet-500',
            note: 'Levenshtein + Jaccard + alignOptions'
        },
        ...(timeline.ragEmbeddingMs !== undefined ? [{
            key: 'ragEmbed',
            label: 'Tạo vector nhúng (RAG Embedding)',
            ms: timeline.ragEmbeddingMs,
            icon: '🧬',
            color: 'bg-purple-500',
            note: 'Embedding câu hỏi'
        }] : []),
        ...(timeline.ragVectorSearchMs !== undefined ? [{
            key: 'ragSearch',
            label: 'Tìm kiếm Vector Qdrant & Rerank',
            ms: timeline.ragVectorSearchMs,
            icon: '⚡',
            color: 'bg-fuchsia-500',
            note: 'Truy vấn tài liệu quy định'
        }] : []),
        ...(timeline.ragAnswerMs !== undefined ? [{
            key: 'ragAnswer',
            label: 'AI sinh câu trả lời RAG',
            ms: timeline.ragAnswerMs,
            icon: '🧠',
            color: 'bg-pink-500',
            note: 'Gemini Generate Content'
        }] : []),
    ];

    // Tìm công đoạn tốn nhiều thời gian nhất (Bottleneck)
    const bottleneck = stages.reduce((max, cur) => (cur.ms > max.ms ? cur : max), stages[0]);
    const bottleneckPercent = Math.round((bottleneck.ms / totalMs) * 100);

    return (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 p-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-xl">⏱️</span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h5 className="font-bold text-sm sm:text-base text-white">Timeline xử lý</h5>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                Admin Only
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Thời gian thực tế từng công đoạn từ khi bấm chụp</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getBadgeStyle(totalMs)}`}>
                        Tổng: {totalSeconds}s ({totalMs} ms)
                    </span>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                        title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Bottleneck alert banner */}
            {bottleneck && bottleneckPercent >= 35 && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>
                            <strong>Điểm nghẽn chính:</strong> {bottleneck.label}
                        </span>
                    </div>
                    <span className="font-bold whitespace-nowrap bg-amber-500/20 px-2 py-0.5 rounded">
                        {(bottleneck.ms / 1000).toFixed(2)}s ({bottleneckPercent}%)
                    </span>
                </div>
            )}

            {/* Expanded stages detail */}
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
                    {stages.map((stage) => {
                        const percent = Math.min(100, Math.max(1, Math.round((stage.ms / totalMs) * 100)));
                        const isMax = stage.key === bottleneck.key;

                        return (
                            <div key={stage.key} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span>{stage.icon}</span>
                                        <span className={`font-medium ${isMax ? 'text-amber-300 font-semibold' : 'text-slate-300'}`}>
                                            {stage.label}
                                        </span>
                                        {stage.note && (
                                            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">
                                                • {stage.note}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                                        <span className={`font-semibold ${isMax ? 'text-amber-300' : 'text-slate-200'}`}>
                                            {stage.ms >= 1000 ? `${(stage.ms / 1000).toFixed(2)}s` : `${stage.ms}ms`}
                                        </span>
                                        <span className="text-slate-500 w-9 text-right text-[11px]">
                                            {percent}%
                                        </span>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${stage.color} ${isMax ? 'ring-1 ring-amber-400' : ''}`}
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SearchTimelineView;
