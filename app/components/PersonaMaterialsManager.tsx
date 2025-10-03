"use client";

import { useState, useEffect } from "react";

interface PersonaMaterial {
  name: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export default function PersonaMaterialsManager() {
  const [materials, setMaterials] = useState<PersonaMaterial[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(true);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Load persona materials
  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/persona-materials");
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error("Error loading persona materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const toggleFileExpansion = (fileName: string) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const handleDelete = async (fileName: string) => {
    if (showDeleteConfirm) {
      setFileToDelete(fileName);
    } else {
      await deleteFile(fileName);
    }
  };

  const deleteFile = async (fileName: string) => {
    try {
      const response = await fetch("/api/persona-materials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });

      if (response.ok) {
        await loadMaterials();
        setFileToDelete(null);
      } else {
        alert("ファイルの削除に失敗しました");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("ファイルの削除中にエラーが発生しました");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          人格形成用ファイル管理
        </h2>
        <button
          onClick={loadMaterials}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          更新
        </button>
      </div>

      {/* Delete confirmation toggle */}
      <div className="mb-4 flex items-center space-x-2">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showDeleteConfirm}
            onChange={(e) => setShowDeleteConfirm(e.target.checked)}
            className="mr-2 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            削除時に確認モーダルを表示
          </span>
        </label>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            人格形成用ファイルが登録されていません
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((material) => (
            <div
              key={material.name}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* File Header */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900">
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {material.name.endsWith(".md") ? "MD" : "TXT"}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {material.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(material.size)} •{" "}
                      {formatDate(material.modifiedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleFileExpansion(material.name)}
                    className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    title="内容を表示/非表示"
                  >
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        expandedFiles.has(material.name) ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(material.name)}
                    className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    title="削除"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* File Content Preview */}
              {expandedFiles.has(material.name) && (
                <div className="p-4 bg-gray-100 dark:bg-gray-900">
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                    {material.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && fileToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ファイルの削除確認
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              「{fileToDelete}」を削除しますか？
              <br />
              この操作は取り消せません。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteFile(fileToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {materials.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            ファイル統計
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">総ファイル数</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {materials.length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">TXTファイル</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {materials.filter((m) => m.name.endsWith(".txt")).length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">MDファイル</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {materials.filter((m) => m.name.endsWith(".md")).length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">合計サイズ</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatFileSize(materials.reduce((sum, m) => sum + m.size, 0))}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
