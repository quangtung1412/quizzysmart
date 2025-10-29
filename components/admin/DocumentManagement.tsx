/**
 * DocumentManagement Component
 * 
 * Admin screen for managing RAG documents
 * Upload PDFs, view processing status, manage documents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../../src/socket';
import DocumentDetailModal from './DocumentDetailModal';

interface Document {
  id: string;
  fileName: string;
  documentName: string;
  documentNumber?: string;
  documentType?: string;
  uploadedAt: string;
  processingStatus: 'processing' | 'completed' | 'failed';
  chunksCount: number;
}

interface ProcessingProgress {
  documentId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  error?: string;
  chunksCreated?: number;
  chunksEmbedded?: number;
}

const DocumentManagement: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<Map<string, ProcessingProgress>>(new Map());
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  // Fetch documents list
  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();

    // Listen for processing updates via Socket.IO
    socket.on('document:processing', (progress: ProcessingProgress) => {
      console.log('Processing update:', progress);
      setProcessingProgress(prev => new Map(prev).set(progress.documentId, progress));

      // Refresh document list when processing completes
      if (progress.status === 'completed' || progress.status === 'failed') {
        setTimeout(fetchDocuments, 1000);
      }
    });

    return () => {
      socket.off('document:processing');
    };
  }, [fetchDocuments]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      alert('Chỉ chấp nhận file PDF!');
    }
    
    if (pdfFiles.length > 10) {
      alert('Tối đa 10 files!');
      setSelectedFiles(pdfFiles.slice(0, 10));
    } else {
      setSelectedFiles(pdfFiles);
    }
  };

  // Handle drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length > 10) {
      alert('Tối đa 10 files!');
      setSelectedFiles(pdfFiles.slice(0, 10));
    } else {
      setSelectedFiles(pdfFiles);
    }
  };

  // Upload files
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Chọn file để upload!');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('documents', file);
      });

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Upload thành công ${result.documents.length} files!`);
        setSelectedFiles([]);
        fetchDocuments();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Lỗi khi upload file!');
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDelete = async (documentId: string, fileName: string) => {
    if (!confirm(`Xóa văn bản "${fileName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        alert('Đã xóa văn bản');
        fetchDocuments();
      } else {
        alert('Lỗi khi xóa');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Lỗi khi xóa văn bản');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">✓ Hoàn thành</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">⏳ Đang xử lý</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">✗ Lỗi</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          📄 Quản lý Văn bản (RAG)
        </h1>
        <p className="text-gray-600">
          Upload và quản lý các văn bản pháp luật cho hệ thống hỏi đáp AI
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">📤 Upload Văn bản PDF</h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <p className="text-lg mb-2">Kéo thả file PDF vào đây</p>
          <p className="text-sm text-gray-500 mb-4">hoặc</p>
          
          <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            Chọn file
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          
          <p className="text-xs text-gray-500 mt-4">
            Tối đa 10 files, mỗi file tối đa 50MB
          </p>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">File đã chọn ({selectedFiles.length}):</h3>
            <div className="space-y-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`mt-4 w-full py-3 rounded-lg font-semibold ${
                uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {uploading ? '⏳ Đang upload...' : `📤 Upload ${selectedFiles.length} file`}
            </button>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">📚 Danh sách Văn bản ({documents.length})</h2>
        
        {documents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Chưa có văn bản nào. Hãy upload file PDF để bắt đầu.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map(doc => {
              const progress = processingProgress.get(doc.id);
              
              return (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">{doc.documentName}</h3>
                        {getStatusBadge(doc.processingStatus)}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {doc.documentNumber && (
                          <div>📋 Số văn bản: <span className="font-medium">{doc.documentNumber}</span></div>
                        )}
                        {doc.documentType && (
                          <div>📑 Loại: {doc.documentType}</div>
                        )}
                        <div>📁 File: {doc.fileName}</div>
                        <div>📅 Upload: {new Date(doc.uploadedAt).toLocaleString('vi-VN')}</div>
                        <div>🔢 Chunks: {doc.chunksCount}</div>
                      </div>

                      {/* Processing Progress */}
                      {progress && progress.status === 'processing' && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                              {progress.currentStep}
                            </span>
                            <span className="text-sm font-bold text-blue-900">
                              {progress.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                          {progress.chunksCreated && (
                            <div className="text-xs text-blue-700 mt-1">
                              Đã tạo {progress.chunksCreated} chunks
                              {progress.chunksEmbedded && ` - Embedded ${progress.chunksEmbedded}`}
                            </div>
                          )}
                        </div>
                      )}

                      {progress && progress.status === 'failed' && progress.error && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                          ❌ Lỗi: {progress.error}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => setSelectedDocument(doc.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        👁️ Xem
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.documentName)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <DocumentDetailModal
          documentId={selectedDocument}
          onClose={() => {
            setSelectedDocument(null);
            fetchDocuments(); // Refresh list when closing
          }}
        />
      )}
    </div>
  );
};

export default DocumentManagement;
