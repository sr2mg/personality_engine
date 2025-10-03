"use client";

import { useState } from "react";

export default function InputFormManager() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert("タイトルと本文を入力してください");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/save-form-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTitle: title,
          content: content,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`ファイル "${data.fileName}" として保存しました`);
        // フォームをクリア
        setTitle("");
        setContent("");
      } else {
        alert("保存に失敗しました");
      }
    } catch (error) {
      console.error("Error saving form:", error);
      alert("保存中にエラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        テキスト手動入力
      </h2>

      <div className="space-y-4 max-w-2xl">
        {/* タイトル入力欄 */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            タイトル（ファイル名になります）
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトルを入力"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 本文入力欄 */}
        <div>
          <label
            htmlFor="content"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            本文
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="本文を入力"
            rows={10}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          />
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !content.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>

        {/* ファイル名プレビュー */}
        {title.trim() && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              保存されるファイル名:
            </p>
            <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
              text_{title.replace(/[<>:"/\\|?*]/g, "_")}_YYYY-MM-DDThh-mm-ss.txt
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
