/**
 * DocumentDetailModal Component
 * 
 * Show document details, chunks, and markdown content
 * Provide re-extract and re-embed functions
 */

import React, { useState, useEffect } from 'react';

interface DocumentDetail {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  documentNumber?: string;
  documentName: string;
  documentType?: string;
  issuingAgency?: string;
  signerName?: string;
  signerTitle?: string;
  signedDate?: string;
  markdownContent: string;
  processingStatus: string;
  errorMessage?: string;
  chunks: Chunk[];
}

interface Chunk {
  id: string;
  chunkType: string;
  chunkIndex: number;
  content: string;
  metadata: any;
  embeddingStatus: string;
}

interface DocumentDetailModalProps {
  documentId: string;
  onClose: () => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ documentId, onClose }) => {
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'chunks' | 'markdown'>('info');
  const [reExtracting, setReExtracting] = useState(false);
  const [reEmbedding, setReEmbedding] = useState(false);

  useEffect(() => {
    fetchDocumentDetail();
  }, [documentId]);

  const fetchDocumentDetail = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDocument(data);
      }
    } catch (error) {
      console.error('Failed to fetch document detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReExtract = async () => {
    if (!confirm('Extract lại văn bản? Tất cả chunks và embeddings cũ sẽ bị xóa.')) {
      return;
    }

    setReExtracting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/re-extract`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        alert('Đã bắt đầu extract lại. Vui lòng đợi...');
        onClose();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.error}`);
      }
    } catch (error) {
      console.error('Re-extract error:', error);
      alert('Lỗi khi extract lại');
    } finally {
      setReExtracting(false);
    }
  };

  const handleReEmbed = async () => {
    if (!confirm('Tạo embedding lại? Embeddings cũ trong Qdrant sẽ bị xóa.')) {
      return;
    }

    setReEmbedding(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/re-embed`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        alert('Đã bắt đầu tạo embedding lại. Vui lòng đợi...');
        onClose();
      } else {
        const error = await response.json();
        alert(`Lỗi: ${error.error}`);
      }
    } catch (error) {
      console.error('Re-embed error:', error);
      alert('Lỗi khi tạo embedding');
    } finally {
      setReEmbedding(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{document.documentName}</h2>
            {document.documentNumber && (
              <p className="text-sm text-gray-600 mt-1">Số văn bản: {document.documentNumber}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-3xl font-bold ml-4"
          >
            ×
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 px-6 py-3 bg-gray-50 border-b">
          <button
            onClick={handleReExtract}
            disabled={reExtracting}
            className={`px-4 py-2 rounded-lg font-medium ${
              reExtracting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {reExtracting ? '⏳ Đang extract...' : '🔄 Extract lại'}
          </button>
          <button
            onClick={handleReEmbed}
            disabled={reEmbedding || document.chunks.length === 0}
            className={`px-4 py-2 rounded-lg font-medium ${
              reEmbedding || document.chunks.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {reEmbedding ? '⏳ Đang embed...' : '🔄 Embedding lại'}
          </button>
          <div className="flex-1" />
          <div className="text-sm text-gray-600">
            {document.chunks.length} chunks
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            ℹ️ Thông tin
          </button>
          <button
            onClick={() => setActiveTab('chunks')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'chunks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📦 Chunks ({document.chunks.length})
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'markdown'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📝 Markdown
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">File</h3>
                  <p className="text-gray-900">{document.fileName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Kích thước</h3>
                  <p className="text-gray-900">
                    {(document.fileSize / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Upload lúc</h3>
                  <p className="text-gray-900">
                    {new Date(document.uploadedAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Loại văn bản</h3>
                  <p className="text-gray-900">{document.documentType || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Cơ quan ban hành</h3>
                  <p className="text-gray-900">{document.issuingAgency || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Người ký</h3>
                  <p className="text-gray-900">
                    {document.signerName || 'N/A'}
                    {document.signerTitle && ` - ${document.signerTitle}`}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Ngày ký</h3>
                  <p className="text-gray-900">
                    {document.signedDate
                      ? new Date(document.signedDate).toLocaleDateString('vi-VN')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-1">Trạng thái</h3>
                  <p className="text-gray-900">{document.processingStatus}</p>
                </div>
              </div>

              {document.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Lỗi</h3>
                  <p className="text-sm text-red-700">{document.errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chunks' && (
            <div className="space-y-3">
              {document.chunks.map((chunk, idx) => (
                <div key={chunk.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-gray-500">#{chunk.chunkIndex}</span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {chunk.chunkType}
                      </span>
                      {chunk.embeddingStatus === 'completed' && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          ✓ Embedded
                        </span>
                      )}
                    </div>
                    {chunk.metadata.articleNumber && (
                      <span className="text-sm text-gray-600">
                        Điều {chunk.metadata.articleNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                    {chunk.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'markdown' && (
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border">
                {document.markdownContent || 'Chưa có nội dung markdown'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;
