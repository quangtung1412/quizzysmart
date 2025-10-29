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

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    loadHistory();
    loadDocuments();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await api.chatHistory(50);
      setMessages(response.messages || []);
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
    setSelectedDocuments([]); // Clear selected documents
    setIsLoading(true);

    // Add user message placeholder
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
      // Use EventSource for SSE streaming
      const response = await fetch(`${API_BASE}/api/chat/ask-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamingAnswer = '';
      let finalMessageId: number | null = null;
      let finalSources: any[] = [];
      let finalConfidence: number = 0;

      if (!reader) {
        throw new Error('No reader available');
      }

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
              // Update status message
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? { ...msg, answer: `⏳ ${data.message}` }
                    : msg
                )
              );
            } else if (event === 'chunk') {
              // Append text chunk
              streamingAnswer += data.text;
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? { ...msg, answer: streamingAnswer }
                    : msg
                )
              );
            } else if (event === 'complete') {
              // Stream completed
              finalMessageId = data.messageId;
              finalSources = data.sources || [];
              finalConfidence = data.confidence || 0;
              
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? {
                        ...msg,
                        id: finalMessageId || msg.id,
                        answer: streamingAnswer,
                        sources: finalSources,
                        confidence: finalConfidence,
                      }
                    : msg
                )
              );
            } else if (event === 'error') {
              // Error occurred
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === tempMessageId
                    ? { ...msg, answer: `❌ Lỗi: ${data.message}` }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Lỗi gửi câu hỏi:', error);
      
      // Show error message
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? {
                ...msg,
                answer: `❌ Lỗi: ${error.message || 'Không thể kết nối đến server'}`,
              }
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

    // Check if user typed # at the start or after a space
    const lastChar = value[value.length - 1];
    const beforeLastChar = value[value.length - 2];
    
    if (lastChar === '#' && (!beforeLastChar || beforeLastChar === ' ' || beforeLastChar === '\n')) {
      setShowDocumentPicker(true);
    }
  };

  const handleDocumentSelect = (docId: string) => {
    if (selectedDocuments.includes(docId)) {
      setSelectedDocuments(prev => prev.filter(id => id !== docId));
    } else {
      setSelectedDocuments(prev => [...prev, docId]);
    }
  };

  const handleApplyDocumentFilter = () => {
    if (selectedDocuments.length > 0) {
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      const docNames = selectedDocs.map(doc => doc.documentName || doc.fileName).join(', ');
      
      // Remove the # and add the document filter to the question
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
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Function to render answer with clickable citations
  const renderAnswerWithCitations = (answer: string, sources: any[]) => {
    if (!sources || sources.length === 0) {
      return <p className="text-gray-800 whitespace-pre-wrap">{answer}</p>;
    }

    // Replace [🔗1], [🔗2], etc. with clickable citation links
    const parts = answer.split(/(\[🔗\d+\])/g);
    
    return (
      <p className="text-gray-800 whitespace-pre-wrap">
        {parts.map((part, idx) => {
          const match = part.match(/\[🔗(\d+)\]/);
          if (match) {
            const sourceIndex = parseInt(match[1]) - 1;
            const source = sources[sourceIndex];
            
            if (source) {
              const tooltipText = `${source.metadata?.documentNumber || 'Tài liệu'} - ${source.metadata?.chunkType || 'Phần'} ${source.metadata?.chunkIndex || ''}`;
              
              return (
                <span
                  key={idx}
                  onClick={() => setSelectedSource(source)}
                  className="inline-flex items-center mx-0.5 px-1 py-0.5 bg-blue-100 text-blue-600 rounded cursor-pointer text-xs font-medium hover:bg-blue-200 transition-colors"
                  title={tooltipText}
                >
                  🔗{match[1]}
                </span>
              );
            }
          }
          return <span key={idx}>{part}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[700px] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Trợ lý AI Học tập</h2>
              <p className="text-xs text-blue-100">Hỏi đáp từ tài liệu đã tải lên</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Chưa có cuộc trò chuyện</p>
              <p className="text-sm">Hãy đặt câu hỏi để bắt đầu!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {/* User Question */}
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] shadow-md">
                    <p className="text-sm">{msg.question}</p>
                    <p className="text-xs text-blue-100 mt-1">{formatTime(msg.createdAt)}</p>
                  </div>
                </div>

                {/* AI Answer */}
                <div className="flex justify-start items-start gap-2">
                  <div className="bg-gradient-to-br from-purple-500 to-blue-500 text-white p-2 rounded-full flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%] shadow-md border border-gray-200 relative group">
                    <div className="prose prose-sm max-w-none">
                      {renderAnswerWithCitations(msg.answer, msg.sources)}
                    </div>
                    
                    {/* Sources - Only show if there are sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">📚 Nguồn tham khảo:</p>
                        <div className="space-y-1">
                          {msg.sources.map((source: any, idx: number) => (
                            <div key={idx} className="text-xs text-gray-500 flex items-start gap-1">
                              <span className="text-blue-500 font-medium">🔗{idx + 1}</span>
                              <span>
                                {source.metadata?.documentNumber || 'Tài liệu'} - 
                                {source.metadata?.chunkType || 'Phần'} {source.metadata?.chunkIndex || ''}
                                {source.score && ` (${(source.score * 100).toFixed(0)}%)`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence & Actions */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {msg.confidence && (
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {(msg.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        <span>{formatTime(msg.createdAt)}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                        title="Xóa tin nhắn"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200 rounded-b-2xl relative">
          {/* Document Picker Modal */}
          {showDocumentPicker && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-300 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50">
              <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">📁 Chọn tài liệu để tìm kiếm</h3>
                  <button
                    onClick={() => setShowDocumentPicker(false)}
                    className="hover:bg-white hover:bg-opacity-20 p-1 rounded"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-3 space-y-2">
                {documents.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Chưa có tài liệu nào</p>
                ) : (
                  documents.map(doc => (
                    <label
                      key={doc.id}
                      className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleDocumentSelect(doc.id)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
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
                <div className="sticky bottom-0 bg-gray-50 border-t p-3">
                  <button
                    onClick={handleApplyDocumentFilter}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  >
                    Áp dụng ({selectedDocuments.length} tài liệu)
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Đặt câu hỏi về tài liệu... (Gõ # để chọn tài liệu cụ thể)"
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl px-6 py-3 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                  <span>Gửi</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            💡 Nhấn Enter để gửi, Shift+Enter để xuống dòng • Gõ # để chọn tài liệu cụ thể
          </p>
        </div>
      </div>

      {/* Source Detail Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black bg-opacity-60 p-4" onClick={() => setSelectedSource(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <h3 className="font-bold text-lg">Chi tiết nguồn trích dẫn</h3>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Document Info */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">📄 Tài liệu</p>
                    <p className="font-semibold text-gray-800">{selectedSource.metadata?.documentName || selectedSource.documentName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">🔢 Số hiệu</p>
                    <p className="font-semibold text-gray-800">{selectedSource.metadata?.documentNumber || selectedSource.documentNumber || 'N/A'}</p>
                  </div>
                  {selectedSource.metadata?.chapterNumber && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">📚 Chương</p>
                      <p className="font-semibold text-gray-800">Chương {selectedSource.metadata.chapterNumber}</p>
                    </div>
                  )}
                  {selectedSource.metadata?.articleNumber && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">📋 Điều</p>
                      <p className="font-semibold text-gray-800">Điều {selectedSource.metadata.articleNumber}</p>
                    </div>
                  )}
                  {selectedSource.score && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">🎯 Độ liên quan</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${selectedSource.score * 100}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-800">{(selectedSource.score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                  Nội dung trích xuất
                </p>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {selectedSource.content || 'Không có nội dung'}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              {selectedSource.metadata && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Thông tin bổ sung
                  </p>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 grid grid-cols-2 gap-2 text-xs">
                    {selectedSource.metadata.chunkType && (
                      <div>
                        <span className="text-gray-600">Loại phần:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedSource.metadata.chunkType}</span>
                      </div>
                    )}
                    {selectedSource.metadata.chunkIndex !== undefined && (
                      <div>
                        <span className="text-gray-600">Vị trí:</span>
                        <span className="ml-2 font-medium text-gray-800">#{selectedSource.metadata.chunkIndex}</span>
                      </div>
                    )}
                    {selectedSource.metadata.chapterTitle && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Tiêu đề chương:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedSource.metadata.chapterTitle}</span>
                      </div>
                    )}
                    {selectedSource.metadata.articleTitle && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Tiêu đề điều:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedSource.metadata.articleTitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t rounded-b-2xl">
              <button
                onClick={() => setSelectedSource(null)}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl px-4 py-2 font-medium transition-all"
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
