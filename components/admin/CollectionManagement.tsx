/**
 * CollectionManagement Component
 * 
 * Admin screen for managing Qdrant vector database collections
 */

import React, { useState, useEffect } from 'react';

interface Collection {
  name: string;
  vectorsCount?: number;
  pointsCount?: number;
  status?: string;
}

const CollectionManagement: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch collections
  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/collections', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }

      const data = await response.json();
      setCollections(data.collections || []);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Create new collection
  const createCollection = async () => {
    if (!newCollectionName.trim()) {
      setError('Tên collection không được để trống');
      return;
    }

    // Validate collection name
    if (!/^[a-zA-Z0-9_-]+$/.test(newCollectionName)) {
      setError('Tên collection chỉ được chứa chữ cái, số, gạch ngang và gạch dưới');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newCollectionName,
          vectorSize: 768, // Google Embedding dimension
          distance: 'Cosine',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create collection');
      }

      setSuccess(`Collection "${newCollectionName}" đã được tạo thành công`);
      setNewCollectionName('');
      setShowCreateModal(false);
      await fetchCollections();
    } catch (err) {
      console.error('Error creating collection:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  // Delete collection
  const deleteCollection = async (name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa collection "${name}"?\n\nToàn bộ dữ liệu vector sẽ bị mất vĩnh viễn!`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/admin/collections/${name}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete collection');
      }

      setSuccess(`Collection "${name}" đã được xóa`);
      await fetchCollections();
    } catch (err) {
      console.error('Error deleting collection:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Quản Lý Collections</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Tạo Collection Mới
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Về Collections</h3>
          <p className="text-sm text-blue-800">
            Collections là các kho lưu trữ vector riêng biệt trong Qdrant. Bạn có thể tạo các collections 
            khác nhau cho từng loại tài liệu (VD: tien_gui, tien_vay, the, v.v.) để tối ưu hóa việc tìm kiếm.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Đang tải collections...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.name}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-800 flex-1">
                  {collection.name}
                </h3>
                <span className={`px-2 py-1 text-xs rounded ${
                  collection.status === 'green' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {collection.status || 'unknown'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Vectors:</span>
                  <span className="font-medium">{collection.vectorsCount?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Points:</span>
                  <span className="font-medium">{collection.pointsCount?.toLocaleString() || 0}</span>
                </div>
              </div>

              <button
                onClick={() => deleteCollection(collection.name)}
                className="w-full px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors text-sm font-medium"
              >
                Xóa Collection
              </button>
            </div>
          ))}
        </div>
      )}

      {collections.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Chưa có collection nào</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tạo Collection Đầu Tiên
          </button>
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Tạo Collection Mới</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tên Collection
              </label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="vd: tien_gui, tien_vay, the"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={creating}
              />
              <p className="text-xs text-gray-500 mt-1">
                Chỉ sử dụng chữ thường, số, gạch ngang (-) và gạch dưới (_)
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium mb-1">Gợi ý phân loại:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li><code>tien_gui</code> - Tài liệu về tiền gửi, tiết kiệm</li>
                <li><code>tien_vay</code> - Tài liệu về cho vay, tín dụng</li>
                <li><code>chuyen_tien</code> - Chuyển tiền, thanh toán</li>
                <li><code>the</code> - Thẻ tín dụng, thẻ ghi nợ</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCollectionName('');
                  setError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={creating}
              >
                Hủy
              </button>
              <button
                onClick={createCollection}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={creating}
              >
                {creating ? 'Đang tạo...' : 'Tạo Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionManagement;
