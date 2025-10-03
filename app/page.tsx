"use client";

import { useState, useEffect, useCallback } from "react";
import ConfigEditor from "./components/ConfigEditor";
import InputFormManager from "./components/InputFormManager";
import FileDropZone from "./components/FileDropZone";
import PersonalityEngine from "./components/PersonalityEngine";

export default function Home() {
  const [config, setConfig] = useState<any>(null);
  const [inputForms, setInputForms] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "config" | "forms" | "files" | "engine"
  >("config");

  // Load initial config
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("Failed to load config:", err));
  }, []);

  // Save config
  const saveConfig = async (newConfig: any, character: string) => {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: newConfig, character }),
      });
      if (response.ok) {
        setConfig(newConfig);
        alert(`${character}の設定を保存しました`);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      alert("設定の保存に失敗しました");
    }
  };

  // Handle file drops
  const handleFileDrop = useCallback((files: File[]) => {
    const validFiles = files.filter(
      (file) => file.name.endsWith(".txt") || file.name.endsWith(".md")
    );

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedFiles((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            name: file.name,
            content: e.target?.result as string,
            type: file.name.endsWith(".txt") ? "txt" : "md",
            uploadedAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsText(file);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Personality Engine WebUI
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              命を作れ。
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("config")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "config"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              設定管理
            </button>
            <button
              onClick={() => setActiveTab("forms")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "forms"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              入力フォーム
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "files"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              ファイル管理 ({uploadedFiles.length})
            </button>
            <button
              onClick={() => setActiveTab("engine")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "engine"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              人格形成
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {activeTab === "config" && config && (
            <ConfigEditor config={config} onSave={saveConfig} />
          )}

          {activeTab === "forms" && <InputFormManager />}

          {activeTab === "files" && (
            <FileDropZone
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              onFileDrop={handleFileDrop}
            />
          )}

          {activeTab === "engine" && <PersonalityEngine />}
        </div>
      </main>
    </div>
  );
}
