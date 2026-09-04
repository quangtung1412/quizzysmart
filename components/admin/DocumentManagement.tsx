/**
 * DocumentManagement Component
 * 
 * Admin screen for managing RAG documents
 * Upload PDFs, view processing status, manage documents
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  qdrantCollectionName?: string;
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

interface Collection {
  name: string;
  pointsCount?: number;
}

const DocumentManagement: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<Map<string, ProcessingProgress>>(new Map());
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  
  // Collection management for upload
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uploadCollection, setUploadCollection] = useState<string>('');
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Filters for document list
  const [filterCollection, setFilterCollection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      setLoadingCollections(true);
      const response = await fetch('/api/admin/collections', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
        // Auto-select first collection for upload if none selected
        if (!uploadCollection && data.collections.length > 0) {
          setUploadCollection(data.collections[0].name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  }, [uploadCollection]);

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
    fetchCollections(); // NEW: Also fetch collections

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
  }, [fetchDocuments, fetchCollections]); // NEW: Add fetchCollections to deps

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter((f: File) => f.type === 'application/pdf');
    
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
    const pdfFiles = files.filter((f: File) => f.type === 'application/pdf');
    
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

    // Validate collection selected
    if (!uploadCollection) {
      alert('Vui lòng chọn collection trước khi upload!');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('documents', file);
      });
      
      // Add collection name to form data
      formData.append('collectionName', uploadCollection);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Upload thành công ${result.documents.length} files vào collection "${uploadCollection}"!`);
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

  // Document count per collection for display in filter dropdown
  const docCountsPerCollection = useMemo(() => {
    const map: Record<string, number> = {};
    documents.forEach(doc => {
      const col = doc.qdrantCollectionName || '__none__';
      map[col] = (map[col] || 0) + 1;
    });
    return map;
  }, [documents]);

  // Statistics for current collection filter (or overall)
  const statusCounts = useMemo(() => {
    const targetDocs = filterCollection === 'all'
      ? documents
      : documents.filter(d => filterCollection === '__none__' ? !d.qdrantCollectionName : d.qdrantCollectionName === filterCollection);

    let completed = 0;
    let processing = 0;
    let failed = 0;

    targetDocs.forEach(d => {
      if (d.processingStatus === 'completed') completed++;
      else if (d.processingStatus === 'processing') processing++;
      else if (d.processingStatus === 'failed') failed++;
    });

    return {
      total: targetDocs.length,
      completed,
      processing,
      failed,
    };
  }, [documents, filterCollection]);

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Filter by collection
      if (filterCollection !== 'all') {
        if (filterCollection === '__none__') {
          if (doc.qdrantCollectionName) return false;
        } else if (doc.qdrantCollectionName !== filterCollection) {
          return false;
        }
      }

      // Filter by status
      if (filterStatus !== 'all') {
        if (doc.processingStatus !== filterStatus) return false;
      }

      // Filter by search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        const matchName = doc.documentName?.toLowerCase().includes(query);
        const matchFile = doc.fileName?.toLowerCase().includes(query);
        const matchNumber = doc.documentNumber?.toLowerCase().includes(query);
        const matchType = doc.documentType?.toLowerCase().includes(query);
        const matchCol = doc.qdrantCollectionName?.toLowerCase().includes(query);
        if (!matchName && !matchFile && !matchNumber && !matchType && !matchCol) {
          return false;
        }
      }

      return true;
    });
  }, [documents, filterCollection, filterStatus, searchQuery]);

  const hasActiveFilter = filterCollection !== 'all' || filterStatus !== 'all' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilterCollection('all');
    setFilterStatus('all');
    setSearchQuery('');
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
            ✓ Hoàn thành
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full animate-pulse">
            ⏳ Đang xử lý
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 rounded-full">
            ✗ Lỗi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            {status}
          </span>
        );
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
        
        {/* Collection Selector for Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn Collection lưu trữ <span className="text-red-500">*</span>
          </label>
          <select
            value={uploadCollection}
            onChange={(e) => setUploadCollection(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loadingCollections}
          >
            <option value="">-- Chọn collection --</option>
            {collections.map((collection) => (
              <option key={collection.name} value={collection.name}>
                {collection.name} ({collection.pointsCount || 0} vectors)
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Văn bản sẽ được lưu vào collection này để phân loại và tìm kiếm hiệu quả hơn
          </p>
        </div>
        
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>📚 Danh sách Văn bản</span>
              <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {documents.length}
              </span>
              {hasActiveFilter && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Hiển thị {filteredDocuments.length}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Phân loại theo collection và theo dõi trạng thái hoàn thành xử lý vector embeddings
            </p>
          </div>

          <button
            onClick={() => {
              fetchDocuments();
              fetchCollections();
            }}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            title="Tải lại danh sách"
          >
            🔄 Làm mới
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Filter by Collection */}
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                📦 Lọc theo Collection
              </label>
              <select
                value={filterCollection}
                onChange={(e) => setFilterCollection(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-800"
              >
                <option value="all">Tất cả Collection ({documents.length} văn bản)</option>
                {collections.map((col) => {
                  const count = docCountsPerCollection[col.name] || 0;
                  return (
                    <option key={col.name} value={col.name}>
                      {col.name} ({count} văn bản)
                    </option>
                  );
                })}
                {docCountsPerCollection['__none__'] ? (
                  <option value="__none__">
                    Chưa gán collection ({docCountsPerCollection['__none__']} văn bản)
                  </option>
                ) : null}
              </select>
            </div>

            {/* Search Input */}
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                🔍 Tìm kiếm văn bản
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, số hiệu, file..."
                  className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Reset Button */}
            <div className="md:col-span-2">
              <button
                onClick={handleResetFilters}
                disabled={!hasActiveFilter}
                className={`w-full py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                  hasActiveFilter
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                ✕ Đặt lại
              </button>
            </div>
          </div>

          {/* Status Filter Tabs / Pills */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 mr-1">
              Trạng thái:
            </span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                filterStatus === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span>Tất cả</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                filterStatus === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {statusCounts.total}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                filterStatus === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <span>✓ Đã hoàn thành</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                filterStatus === 'completed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {statusCounts.completed}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('processing')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                filterStatus === 'processing'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
              }`}
            >
              <span>⏳ Đang xử lý</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                filterStatus === 'processing' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
              }`}>
                {statusCounts.processing}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                filterStatus === 'failed'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
              }`}
            >
              <span>✗ Lỗi</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                filterStatus === 'failed' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {statusCounts.failed}
              </span>
            </button>
          </div>
        </div>

        {/* Selected Collection Active Banner */}
        {filterCollection !== 'all' && (
          <div className="mb-4 p-3.5 bg-purple-50 border border-purple-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-sm text-purple-900">
              <span className="text-lg">📦</span>
              <span>
                Đang lọc theo collection: <strong className="font-semibold text-purple-950">{filterCollection === '__none__' ? 'Chưa gán collection' : filterCollection}</strong>
              </span>
              <span className="text-purple-400">•</span>
              <span className="text-xs text-purple-700">
                {statusCounts.total} văn bản ({statusCounts.completed} hoàn thành, {statusCounts.processing} đang xử lý, {statusCounts.failed} lỗi)
              </span>
            </div>
            <button
              onClick={() => setFilterCollection('all')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 underline"
            >
              ✕ Xem tất cả collection
            </button>
          </div>
        )}

        {/* Documents Content */}
        {documents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Chưa có văn bản nào. Hãy upload file PDF để bắt đầu.
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
            <p className="text-gray-600 mb-2">Không tìm thấy văn bản nào phù hợp với bộ lọc hiện tại.</p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-white border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map(doc => {
              const progress = processingProgress.get(doc.id);
              
              return (
                <div key={doc.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg text-slate-900">{doc.documentName}</h3>
                        {getStatusBadge(doc.processingStatus)}
                        {doc.qdrantCollectionName ? (
                          <button
                            onClick={() => setFilterCollection(doc.qdrantCollectionName!)}
                            title="Nhấp để chỉ lọc collection này"
                            className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200 transition-colors cursor-pointer"
                          >
                            📦 {doc.qdrantCollectionName}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                            📦 Chưa gán collection
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {doc.documentNumber && (
                          <div>📋 Số văn bản: <span className="font-medium text-slate-800">{doc.documentNumber}</span></div>
                        )}
                        {doc.documentType && (
                          <div>📑 Loại: <span className="font-medium text-slate-800">{doc.documentType}</span></div>
                        )}
                        <div>📁 File: <span className="font-medium text-slate-800">{doc.fileName}</span></div>
                        <div>📅 Upload: {new Date(doc.uploadedAt).toLocaleString('vi-VN')}</div>
                        <div>🔢 Chunks: <span className="font-medium text-slate-800">{doc.chunksCount}</span></div>
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
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                      >
                        👁️ Xem
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.documentName)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
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
