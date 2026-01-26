import React, { useState, useEffect, useRef } from 'react';
import { api, API_BASE } from '../src/api';

interface ChatMessage {
  id: number;
  userId: number;
  question: string;
  answer: string;
  sources: any[];
  confidence?: number;
  createdAt: string;
}

interface Document {
  id: string;
  fileName: string;
  documentName: string;
  documentNumber: string;
  documentType: string;
}

interface ChatModalProps {
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadHistory();
    loadDocuments();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await api.chatHistory(50);
      setMessages((response.messages || []).reverse());
    } catch (error) {
      console.error('Lỗi tải lịch sử chat:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await api.chatGetDocuments();
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Lỗi tải danh sách tài liệu:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const question = inputValue.trim();
    setInputValue('');
    setSelectedDocuments([]);
    setIsLoading(true);

    const tempMessageId = Date.now();
    const tempMessage: ChatMessage = {
      id: tempMessageId,
      userId: 0,
      question,
      answer: '',
      sources: [],
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const response = await fetch(`${API_BASE}/api/chat/ask-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamingAnswer = '';

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === 'status') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? { ...msg, answer: `⏳ ${data.message}` }
                    : msg
                )
              );
            } else if (event === 'chunk') {
              streamingAnswer += data.text;
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? { ...msg, answer: streamingAnswer }
                    : msg
                )
              );
            } else if (event === 'complete') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? {
                        ...msg,
                        id: data.messageId || msg.id,
                        answer: streamingAnswer,
                        sources: data.sources || [],
                        confidence: data.confidence || 0,
                      }
                    : msg
                )
              );
            } else if (event === 'error') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? { ...msg, answer: `Lỗi: ${data.message}` }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (error: any) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, answer: `Lỗi: ${error.message || 'Không thể kết nối'}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    const lastChar = value[value.length - 1];
    const beforeLastChar = value[value.length - 2];
    
    if (lastChar === '#' && (!beforeLastChar || beforeLastChar === ' ' || beforeLastChar === '\n')) {
      setShowDocumentPicker(true);
    }
  };

  const handleDocumentSelect = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleApplyDocumentFilter = () => {
    if (selectedDocuments.length > 0) {
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      const docNames = selectedDocs.map(doc => doc.documentName || doc.fileName).join(', ');
      const cleanedInput = inputValue.replace(/#\s*$/, '').trim();
      setInputValue(`${cleanedInput} [Tìm trong: ${docNames}]`);
    }
    setShowDocumentPicker(false);
    textareaRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await api.chatDeleteMessage(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Lỗi xóa tin nhắn:', error);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderAnswerWithCitations = (answer: string, sources: any[]) => {
    if (!sources || sources.length === 0) {
      return <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{answer}</p>;
    }

    const parts = answer.split(/(\[🔗\d+\])/g);
    
    return (
      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
        {parts.map((part, idx) => {
          const match = part.match(/\[🔗(\d+)\]/);
          if (match) {
            const sourceIndex = parseInt(match[1]) - 1;
            const source = sources[sourceIndex];
            
            if (source) {
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedSource(source)}
                  className="inline-flex items-center mx-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-200 transition-colors"
                >
                  {match[1]}
                </button>
              );
            }
          }
          return <span key={idx}>{part}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-800">Trợ lý AI</h2>
              <p className="text-xs text-gray-500">Hỏi đáp từ tài liệu của bạn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-800 font-medium mb-1">Bắt đầu cuộc trò chuyện</p>
              <p className="text-sm text-gray-500">Đặt câu hỏi về tài liệu của bạn</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]">
                    <p className="text-sm">{msg.question}</p>
                  </div>
                </div>

                {/* AI response */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 max-w-[85%]">
                    <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 border border-gray-200 group relative">
                      {renderAnswerWithCitations(msg.answer, msg.sources)}
                      
                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Nguồn tham khảo</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedSource(source)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600 transition-colors"
                              >
                                <span className="font-medium">[{idx + 1}]</span>
                                <span className="truncate max-w-[150px]">
                                  {source.metadata?.documentNumber || 'Tài liệu'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Timestamp */}
                    <p className="text-xs text-gray-400 mt-1 px-1">{formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-gray-100 relative">
          {/* Document Picker */}
          {showDocumentPicker && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="font-medium text-gray-800">Chọn tài liệu</p>
                <button
                  onClick={() => setShowDocumentPicker(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="max-h-60 overflow-y-auto p-2">
                {documents.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Chưa có tài liệu</p>
                ) : (
                  documents.map(doc => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleDocumentSelect(doc.id)}
                        className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {doc.documentName || doc.fileName}
                        </p>
                        {doc.documentNumber && (
                          <p className="text-xs text-gray-500">{doc.documentNumber}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>

              {selectedDocuments.length > 0 && (
                <div className="p-3 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={handleApplyDocumentFilter}
                    className="w-full py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    Áp dụng ({selectedDocuments.length})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Nhập câu hỏi... (# để chọn tài liệu)"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-100 border-0 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Source Detail Modal */}
      {selectedSource && (
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedSource(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-800">Chi tiết nguồn</h3>
              <button
                onClick={() => setSelectedSource(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Tài liệu</p>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedSource.metadata?.documentName || 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Số hiệu</p>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedSource.metadata?.documentNumber || 'N/A'}
                  </p>
                </div>
                {selectedSource.metadata?.chapterNumber && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">Chương</p>
                    <p className="text-sm font-medium text-gray-800">
                      Chương {selectedSource.metadata.chapterNumber}
                    </p>
                  </div>
                )}
                {selectedSource.metadata?.articleNumber && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">Điều</p>
                    <p className="text-sm font-medium text-gray-800">
                      Điều {selectedSource.metadata.articleNumber}
                    </p>
                  </div>
                )}
              </div>

              {/* Relevance */}
              {selectedSource.score && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Độ liên quan</p>
                    <p className="text-sm font-medium text-blue-600">
                      {(selectedSource.score * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${selectedSource.score * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Nội dung</p>
                <div className="bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedSource.content || 'Không có nội dung'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedSource(null)}
                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModal;
