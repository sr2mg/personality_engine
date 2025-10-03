"use client";

import { useState, useCallback, DragEvent, useEffect } from "react";

interface UploadedFile {
  id: number;
  name: string;
  content: string;
  type: "txt" | "md";
  uploadedAt: string;
  source: "upload" | "saved"; // ファイルの出所を追加
}

interface PersonaMaterial {
  name: string;
  content: string;
  size: number;
  modifiedAt: string;
}

interface FileDropZoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onFileDrop: (files: File[]) => void;
}

export default function FileDropZone({
  files,
  onFilesChange,
  onFileDrop,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savedFiles, setSavedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // persona_materialsディレクトリからファイルを読み込む
  const loadSavedFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/persona-materials");
      if (response.ok) {
        const data = await response.json();
        const materials: PersonaMaterial[] = data.materials || [];

        // PersonaMaterialをUploadedFile形式に変換
        const convertedFiles: UploadedFile[] = materials.map(
          (material, index) => ({
            id: Date.now() + index, // 一意のIDを生成
            name: material.name,
            content: material.content,
            type: material.name.endsWith(".md") ? "md" : "txt",
            uploadedAt: material.modifiedAt,
            source: "saved" as const,
          })
        );

        setSavedFiles(convertedFiles);
      }
    } catch (error) {
      console.error("Error loading saved files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedFiles();
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      onFileDrop(droppedFiles);
    },
    [onFileDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        onFileDrop(selectedFiles);
      }
    },
    [onFileDrop]
  );

  const deleteFile = (fileId: number) => {
    onFilesChange(files.filter((file) => file.id !== fileId));
  };

  const saveToPersonaMaterials = async (file: UploadedFile) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/save-uploaded-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          content: file.content,
        }),
      });

      if (response.ok) {
        alert(`${file.name} を人格形成用ファイルとして保存しました`);
        // 保存後にファイルリストを更新
        await loadSavedFiles();
      } else {
        alert("ファイルの保存に失敗しました");
      }
    } catch (error) {
      console.error("Error saving file:", error);
      alert("ファイルの保存中にエラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFromPersonaMaterials = async (fileName: string) => {
    try {
      const response = await fetch("/api/persona-materials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });

      if (response.ok) {
        // 削除後にファイルリストを更新
        await loadSavedFiles();
      } else {
        alert("ファイルの削除に失敗しました");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("ファイルの削除中にエラーが発生しました");
    }
  };

  const toggleFileExpansion = (fileId: number) => {
    setExpandedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const formatFileSize = (content: string) => {
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // アップロードファイルと保存済みファイルを結合
  const allFiles = [...files, ...savedFiles];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          ファイル管理
        </h2>
        <button
          onClick={loadSavedFiles}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          更新
        </button>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-lg mb-2 text-gray-700 dark:text-gray-300">
          ここにファイルをドラッグ＆ドロップ
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">または</p>
        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
          <span>ファイルを選択</span>
          <input
            type="file"
            multiple
            accept=".txt,.md"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          対応形式: .txt, .md
        </p>
      </div>

      {/* Files List */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          すべてのファイル ({allFiles.length})
        </h3>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : allFiles.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            ファイルがありません
          </p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {allFiles.map((file) => (
              <div
                key={file.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* File Header */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        file.type === "txt"
                          ? "bg-blue-100 dark:bg-blue-900"
                          : "bg-green-100 dark:bg-green-900"
                      }`}
                    >
                      <span
                        className={`text-sm font-bold ${
                          file.type === "txt"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {file.type.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </h4>
                        {file.source === "saved" && (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                            保存済み
                          </span>
                        )}
                        {file.source === "upload" && (
                          <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                            アップロード
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.content)} •{" "}
                        {new Date(file.uploadedAt).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {file.source === "upload" && (
                      <button
                        onClick={() => saveToPersonaMaterials(file)}
                        disabled={isSaving}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        人格形成に使用
                      </button>
                    )}
                    <button
                      onClick={() => toggleFileExpansion(file.id)}
                      className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                      title="内容を表示/非表示"
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform ${
                          expandedFiles.has(file.id) ? "rotate-180" : ""
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
                      onClick={() => {
                        if (file.source === "saved") {
                          deleteFromPersonaMaterials(file.name);
                        } else {
                          deleteFile(file.id);
                        }
                      }}
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
                {expandedFiles.has(file.id) && (
                  <div className="p-4 bg-gray-100 dark:bg-gray-900">
                    <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {file.content.length > 1000
                        ? file.content.substring(0, 1000) + "..."
                        : file.content}
                    </pre>
                    {file.content.length > 1000 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        表示は最初の1000文字までです
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {allFiles.length > 0 && (
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            ファイル統計
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">総ファイル数</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {allFiles.length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">アップロード</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {files.length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">保存済み</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {savedFiles.length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">TXTファイル</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {allFiles.filter((f) => f.type === "txt").length}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">MDファイル</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {allFiles.filter((f) => f.type === "md").length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
