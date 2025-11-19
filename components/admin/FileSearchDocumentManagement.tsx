/**
 * File Search Document Management Component
 * 
 * Admin interface for uploading and managing documents in Google File Search stores
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../src/api';

interface FileSearchStore {
    name: string;
    displayName: string;
    createTime: string;
}

interface FileSearchDocument {
    name: string;
    displayName: string;
    mimeType: string;
    sizeBytes: string;
    state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
    uploadedAt?: string;
}

interface LocalDocument {
    id: string;
    fileName: string;
    documentName: string;
    ragMethod: string;
    fileSearchStoreName?: string;
    fileSearchDocumentName?: string;
    processingStatus: string;
    uploadedAt: string;
}

export default function FileSearchDocumentManagement() {
    const [stores, setStores] = useState<FileSearchStore[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [documents, setDocuments] = useState<LocalDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // File upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    useEffect(() => {
        loadStores();
        loadDocuments();
    }, []);

    useEffect(() => {
        if (selectedStore) {
            loadDocuments();
        }
    }, [selectedStore]);

    const loadStores = async () => {
        try {
            setLoading(true);
            const response = await api.ragConfigListStores();
            setStores(response.stores || []);

            if (response.stores && response.stores.length > 0) {
                setSelectedStore(response.stores[0].name);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load stores');
        } finally {
            setLoading(false);
        }
    };

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const response = await api.ragConfigListDocuments(
                'google-file-search',
                selectedStore || undefined
            );
            setDocuments(response.documents || []);
        } catch (err: any) {
            console.error('Failed to load documents:', err);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                setError('Chỉ hỗ trợ file PDF');
                return;
            }
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                setError('File không được vượt quá 50MB');
                return;
            }
            setSelectedFile(file);
            setError(null);
        }
    };

    const handleUploadToFileSearch = async () => {
        if (!selectedFile || !selectedStore) {
            setError('Vui lòng chọn file và store');
            return;
        }

        try {
            setUploading(true);
            setUploadProgress('Đang đọc file...');
            setError(null);
            setSuccessMessage(null);

            setUploadProgress('Đang upload lên File Search...');

            const response = await api.ragConfigUploadToFileSearch(
                selectedFile,
                selectedStore,
                selectedFile.name
            );

            setUploadProgress('Đang xử lý tài liệu...');

            if (response.success) {
                setSuccessMessage(`✅ Upload thành công: ${selectedFile.name}`);
                setSelectedFile(null);
                setUploadProgress('');

                // Reset file input
                const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

                // Reload documents
                await loadDocuments();
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Lỗi khi upload tài liệu');
            setUploadProgress('');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteDocument = async (documentId: string) => {
        if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) {
            return;
        }

        try {
            setLoading(true);
            await api.ragConfigDeleteDocument(documentId);
            setSuccessMessage('✅ Đã xóa tài liệu');
            await loadDocuments();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi xóa tài liệu');
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes: string) => {
        const num = parseInt(bytes);
        if (isNaN(num)) return bytes;

        if (num < 1024) return `${num} B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
        return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN');
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    📁 Quản lý tài liệu File Search
                </h2>
                <p className="text-gray-600 mb-6">
                    Upload và quản lý tài liệu PDF trong Google File Search stores.
                    Các tài liệu sẽ được tự động indexing và sẵn sàng cho tìm kiếm.
                </p>

                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                        {successMessage}
                    </div>
                )}

                {/* Store Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="store-select">
                        Chọn File Search Store
                    </label>
                    <select
                        id="store-select"
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading || stores.length === 0}
                    >
                        {stores.length === 0 ? (
                            <option>Chưa có store nào</option>
                        ) : (
                            stores.map((store) => (
                                <option key={store.name} value={store.name}>
                                    {store.displayName} ({store.name})
                                </option>
                            ))
                        )}
                    </select>
                    {stores.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                            Vui lòng tạo File Search Store trước ở tab "Cấu hình RAG"
                        </p>
                    )}
                </div>

                {/* File Upload Section */}
                {stores.length > 0 && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
                            Upload tài liệu mới
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label
                                    htmlFor="file-upload"
                                    className="flex items-center justify-center w-full px-4 py-6 bg-gray-50 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 transition"
                                >
                                    <div className="text-center">
                                        <svg
                                            className="mx-auto h-12 w-12 text-gray-400"
                                            stroke="currentColor"
                                            fill="none"
                                            viewBox="0 0 48 48"
                                        >
                                            <path
                                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {selectedFile ? (
                                                <span className="font-medium text-blue-600">
                                                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="font-medium">Click để chọn file</span> hoặc kéo thả
                                                </>
                                            )}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">Chỉ hỗ trợ PDF (tối đa 50MB)</p>
                                    </div>
                                </label>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </div>

                            {uploadProgress && (
                                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                                    {uploadProgress}
                                </div>
                            )}

                            <button
                                onClick={handleUploadToFileSearch}
                                disabled={!selectedFile || uploading || !selectedStore}
                                className={`w-full px-6 py-3 rounded-lg font-medium transition ${!selectedFile || uploading || !selectedStore
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {uploading ? '⏳ Đang upload...' : '📤 Upload lên File Search'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Documents List */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Tài liệu đã upload ({documents.length})
                    </h3>

                    {loading ? (
                        <div className="text-center py-8 text-gray-500">
                            Đang tải...
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Chưa có tài liệu nào
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Tên file
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Store
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Trạng thái
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Ngày upload
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Thao tác
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {documents.map((doc) => (
                                        <tr key={doc.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {doc.documentName || doc.fileName}
                                                </div>
                                                <div className="text-sm text-gray-500">{doc.fileName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {doc.fileSearchStoreName || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-1 text-xs font-medium rounded-full ${doc.processingStatus === 'completed'
                                                            ? 'bg-green-100 text-green-800'
                                                            : doc.processingStatus === 'processing'
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : 'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    {doc.processingStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(doc.uploadedAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <button
                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                    className="text-red-600 hover:text-red-800 font-medium"
                                                    disabled={loading}
                                                >
                                                    Xóa
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">💡 Lưu ý:</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Tài liệu upload lên File Search sẽ được tự động indexing bởi Google</li>
                        <li>Không cần chunking thủ công như Qdrant</li>
                        <li>Hỗ trợ grounding với citations tự động</li>
                        <li>Phù hợp cho document Q&A với context dài</li>
                        <li>Chi phí dựa trên storage và query usage</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
