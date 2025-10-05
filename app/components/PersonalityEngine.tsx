"use client";

import { useState, useEffect } from "react";

interface Philosophy {
  version: string;
  creed: string;
  age_in_days: number;
  stance: {
    economic_left_right: number;
    social_liberal_conservative: number;
  };
  bias: {
    confirmation: number;
    recency: number;
    change_resistance: number;
  };
  hooks: {
    triggers: string[];
    taboos: string[];
  };
}

interface ProcessingResult {
  impressionAfterReading: string;
  thoughts: string;
  worldExperience: {
    description: string;
    your_impression: string;
    fix_arousal: number;
    economicAxisDelta: number;
    socialAxisDelta: number;
  };
  philosophyUpdated: boolean;
  newPhilosophy: Philosophy;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: {
    emotional_tone?: string;
    confidence?: number;
    trigger_detected?: boolean;
    taboo_detected?: boolean;
  };
}

export default function PersonalityEngine() {
  const [philosophy, setPhilosophy] = useState<Philosophy | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [currentPlasticity, setCurrentPlasticity] = useState<number>(1.0);
  const [availableCharacters, setAvailableCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("default");
  const [formationType, setFormationType] = useState<"new" | "continue">(
    "continue"
  );
  const [newCharacterName, setNewCharacterName] = useState<string>("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // 一問一答機能の状態
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [isChatProcessing, setIsChatProcessing] = useState(false);

  // Load available characters on mount
  useEffect(() => {
    loadAvailableCharacters();
  }, []);

  // Load philosophy and available files when character changes
  useEffect(() => {
    if (formationType === "continue" && selectedCharacter) {
      loadPhilosophy();
      loadAvailableFiles();
      loadProfileImage();

      // Refresh file list every 5 seconds
      const interval = setInterval(() => {
        loadAvailableFiles();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedCharacter, formationType]);

  const loadAvailableCharacters = async () => {
    try {
      const response = await fetch("/api/characters");
      if (response.ok) {
        const characters = await response.json();
        setAvailableCharacters(characters);
        if (characters.length > 0 && !characters.includes(selectedCharacter)) {
          setSelectedCharacter(characters[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load characters:", error);
    }
  };

  const loadPhilosophy = async () => {
    try {
      const response = await fetch(
        `/api/philosophy?character=${selectedCharacter}`
      );
      if (response.ok) {
        const data = await response.json();
        setPhilosophy(data);
        calculatePlasticity(data.age_in_days);
      }
    } catch (error) {
      console.error("Failed to load philosophy:", error);
    }
  };

  const loadAvailableFiles = async () => {
    try {
      const response = await fetch("/api/persona-materials");
      if (response.ok) {
        const data = await response.json();
        setAvailableFiles(data.files);
      }
    } catch (error) {
      console.error("Failed to load available files:", error);
    }
  };

  const loadProfileImage = async () => {
    try {
      const response = await fetch(
        `/api/profile-image?character=${selectedCharacter}`
      );
      if (response.ok) {
        const data = await response.json();
        setProfileImage(data.imagePath);
      }
    } catch (error) {
      console.error("Failed to load profile image:", error);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（5MBまで）
    if (file.size > 5 * 1024 * 1024) {
      alert("ファイルサイズが大きすぎます（最大5MB）");
      return;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("characterName", selectedCharacter);

      const response = await fetch("/api/profile-image", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfileImage(data.imagePath + `?t=${Date.now()}`); // キャッシュ回避
      } else {
        const error = await response.json();
        alert(error.error || "画像のアップロードに失敗しました");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      alert("画像のアップロード中にエラーが発生しました");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageDelete = async () => {
    if (!confirm("プロフィール画像を削除しますか？")) return;

    try {
      const response = await fetch(
        `/api/profile-image?character=${selectedCharacter}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setProfileImage(null);
      } else {
        alert("画像の削除に失敗しました");
      }
    } catch (error) {
      console.error("Image delete error:", error);
      alert("画像の削除中にエラーが発生しました");
    }
  };

  const calculatePlasticity = async (age: number) => {
    try {
      const response = await fetch(
        `/api/plasticity?age=${age}&character=${selectedCharacter}`
      );
      if (response.ok) {
        const data = await response.json();
        setCurrentPlasticity(data.plasticity);
      }
    } catch (error) {
      console.error("Failed to calculate plasticity:", error);
    }
  };

  const handleFormationTypeChange = (type: "new" | "continue") => {
    setFormationType(type);
    if (type === "new") {
      setPhilosophy(null);
      setNewCharacterName("");
    } else {
      loadPhilosophy();
    }
  };

  const createNewCharacter = async () => {
    if (!newCharacterName.trim()) {
      alert("キャラクター名を入力してください");
      return;
    }

    // Check if character already exists
    if (availableCharacters.includes(newCharacterName)) {
      alert("このキャラクター名は既に存在します");
      return;
    }

    // Create new character by saving default philosophy
    try {
      const defaultPhilosophy: Philosophy = {
        version: "1.0",
        creed: "まだ何も学習していない",
        age_in_days: 0,
        stance: {
          economic_left_right: 0,
          social_liberal_conservative: 0,
        },
        bias: {
          confirmation: 0.3,
          recency: 0.3,
          change_resistance: 0.3,
        },
        hooks: {
          triggers: ["革新", "変化", "成長"],
          taboos: ["停滞", "固執"],
        },
      };

      const response = await fetch("/api/philosophy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosophy: defaultPhilosophy,
          characterName: newCharacterName,
        }),
      });

      if (response.ok) {
        // Reload characters and switch to the new one
        await loadAvailableCharacters();
        setSelectedCharacter(newCharacterName);
        setFormationType("continue");
        setPhilosophy(defaultPhilosophy);
        calculatePlasticity(0);
      } else {
        alert("キャラクターの作成に失敗しました");
      }
    } catch (error) {
      console.error("Failed to create character:", error);
      alert("キャラクターの作成中にエラーが発生しました");
    }
  };

  const startProcessing = async () => {
    if (selectedFiles.length === 0) {
      alert("処理するファイルを選択してください");
      return;
    }

    const characterToUse =
      formationType === "new" ? newCharacterName : selectedCharacter;
    if (!characterToUse) {
      alert("キャラクターを選択または作成してください");
      return;
    }

    setIsProcessing(true);
    setProcessingLog([]);

    for (const file of selectedFiles) {
      setProcessingLog((prev) => [...prev, `処理中: ${file}`]);

      try {
        const response = await fetch("/api/process-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file,
            philosophy: philosophy,
            characterName: characterToUse,
          }),
        });

        if (response.ok) {
          const result: ProcessingResult = await response.json();

          // Update philosophy
          setPhilosophy(result.newPhilosophy);
          calculatePlasticity(result.newPhilosophy.age_in_days);

          // Add to log
          setProcessingLog((prev) =>
            [
              ...prev,
              `✓ ${file} の処理完了`,
              `  読後の実感: ${result.impressionAfterReading}`,
              `  情緒の揺れ: ${result.worldExperience.fix_arousal}`,
              `  経済観の変化: ${result.worldExperience.economicAxisDelta > 0 ? "+" : ""}${result.worldExperience.economicAxisDelta.toFixed(3)}`,
              `  社会観の変化: ${result.worldExperience.socialAxisDelta > 0 ? "+" : ""}${result.worldExperience.socialAxisDelta.toFixed(3)}`,
              result.philosophyUpdated ? `  ⚡ 信念が更新されました！` : "",
            ].filter(Boolean)
          );
        } else {
          setProcessingLog((prev) => [
            ...prev,
            `✗ ${file} の処理に失敗しました`,
          ]);
        }
      } catch (error) {
        console.error("Processing error:", error);
        setProcessingLog((prev) => [
          ...prev,
          `✗ ${file} の処理中にエラーが発生しました`,
        ]);
      }
    }

    setIsProcessing(false);
    setSelectedFiles([]);

    // Reload philosophy from server to get the latest data saved by process-text API
    await loadPhilosophy();

    // Refresh available files
    await loadAvailableFiles();

    // If this was a new character, add it to the list
    if (formationType === "new") {
      await loadAvailableCharacters();
      setFormationType("continue");
    }
  };

  const toggleFileSelection = (file: string) => {
    setSelectedFiles((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]
    );
  };

  const deleteCharacter = async () => {
    if (selectedCharacter === "default") {
      alert("defaultキャラクターは削除できません");
      return;
    }

    try {
      const response = await fetch(
        `/api/characters/${encodeURIComponent(selectedCharacter)}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setShowDeleteModal(false);
        await loadAvailableCharacters();

        // Select the first available character or default
        const remainingCharacters = availableCharacters.filter(
          (c) => c !== selectedCharacter
        );
        if (remainingCharacters.length > 0) {
          setSelectedCharacter(remainingCharacters[0]);
        } else {
          setSelectedCharacter("default");
        }
      } else {
        const error = await response.json();
        alert(error.error || "キャラクターの削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete character:", error);
      alert("キャラクターの削除中にエラーが発生しました");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion.trim() || isChatProcessing) return;

    const question = currentQuestion.trim();
    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setCurrentQuestion("");
    setIsChatProcessing(true);

    try {
      const response = await fetch("/api/chat-with-personality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          characterName: selectedCharacter,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: result.answer,
          metadata: result.metadata,
        };
        setChatMessages((prev) => [...prev, assistantMessage]);
      } else {
        const error = await response.json();
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "申し訳ありません。回答の生成中にエラーが発生しました。",
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "申し訳ありません。通信エラーが発生しました。",
        },
      ]);
    } finally {
      setIsChatProcessing(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        人格形成エンジン
      </h2>

      {/* Character Selection */}
      <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          キャラクター選択
        </h3>

        <div className="space-y-4">
          {/* Formation Type Selection */}
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="formationType"
                value="continue"
                checked={formationType === "continue"}
                onChange={() => handleFormationTypeChange("continue")}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">継続形成</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="formationType"
                value="new"
                checked={formationType === "new"}
                onChange={() => handleFormationTypeChange("new")}
                className="mr-2"
              />
              <span className="text-gray-700 dark:text-gray-300">新規形成</span>
            </label>
          </div>

          {/* Character Selection or Creation */}
          {formationType === "continue" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                既存のキャラクターを選択
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {availableCharacters.map((character) => (
                    <option key={character} value={character}>
                      {character}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={selectedCharacter === "default"}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    selectedCharacter !== "default"
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  }`}
                >
                  削除
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                新しいキャラクター名
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCharacterName}
                  onChange={(e) => setNewCharacterName(e.target.value)}
                  placeholder="キャラクター名を入力"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={createNewCharacter}
                  disabled={!newCharacterName.trim()}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    newCharacterName.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  }`}
                >
                  作成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Philosophy Status */}
      {philosophy && (
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
            現在の人格状態 -{" "}
            {formationType === "new" ? newCharacterName : selectedCharacter}
          </h3>

          {/* プロフィール画像セクション */}
          <div className="flex items-center gap-6 mb-6">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={selectedCharacter}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl text-gray-400 dark:text-gray-500">
                    👤
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                <label
                  className={`px-3 py-1 text-xs rounded-md cursor-pointer transition-all ${
                    isUploadingImage
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isUploadingImage ? "..." : "変更"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploadingImage}
                    className="hidden"
                  />
                </label>
                {profileImage && (
                  <button
                    onClick={handleImageDelete}
                    disabled={isUploadingImage}
                    className="px-3 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-all disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                中心的信念
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                "{philosophy.creed}"
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                成熟度
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">年齢</span>
                  <span className="font-mono">{philosophy.age_in_days}日</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    可塑性
                  </span>
                  <span className="font-mono">
                    {(currentPlasticity * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${currentPlasticity * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                政治的立場
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      経済観
                    </span>
                    <span className="font-mono">
                      {philosophy.stance.economic_left_right > 0
                        ? "右派"
                        : "左派"}
                      ({philosophy.stance.economic_left_right.toFixed(3)})
                    </span>
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div
                      className="absolute top-0 h-2 bg-gradient-to-r from-red-500 to-blue-500 rounded-full"
                      style={{
                        left: "0",
                        width: "100%",
                        opacity: 0.3,
                      }}
                    />
                    <div
                      className="absolute top-0 w-4 h-4 bg-white dark:bg-gray-300 rounded-full shadow -mt-1"
                      style={{
                        left: `${(philosophy.stance.economic_left_right + 1) * 50}%`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      社会観
                    </span>
                    <span className="font-mono">
                      {philosophy.stance.social_liberal_conservative > 0
                        ? "リベラル"
                        : "保守"}
                      (
                      {philosophy.stance.social_liberal_conservative.toFixed(3)}
                      )
                    </span>
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <div
                      className="absolute top-0 h-2 bg-gradient-to-r from-purple-500 to-green-500 rounded-full"
                      style={{
                        left: "0",
                        width: "100%",
                        opacity: 0.3,
                      }}
                    />
                    <div
                      className="absolute top-0 w-4 h-4 bg-white dark:bg-gray-300 rounded-full shadow -mt-1"
                      style={{
                        left: `${(philosophy.stance.social_liberal_conservative + 1) * 50}%`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                認知バイアス
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    確証バイアス
                  </span>
                  <span className="font-mono">
                    {(philosophy.bias.confirmation * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    新近性バイアス
                  </span>
                  <span className="font-mono">
                    {(philosophy.bias.recency * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    変化抵抗
                  </span>
                  <span className="font-mono">
                    {(philosophy.bias.change_resistance * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Selection */}
      {(philosophy || formationType === "new") && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            処理するファイルを選択
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableFiles.map((file) => (
              <label
                key={file}
                className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedFiles.includes(file)
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file)}
                  onChange={() => toggleFileSelection(file)}
                  className="mr-3"
                  disabled={isProcessing}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {file}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Process Button */}
      {(philosophy || formationType === "new") && (
        <div className="mb-8">
          <button
            onClick={startProcessing}
            disabled={
              isProcessing ||
              selectedFiles.length === 0 ||
              (formationType === "new" && !newCharacterName.trim())
            }
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              isProcessing ||
              selectedFiles.length === 0 ||
              (formationType === "new" && !newCharacterName.trim())
                ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isProcessing
              ? "処理中..."
              : `選択したファイルを処理 (${selectedFiles.length})`}
          </button>
        </div>
      )}

      {/* Processing Log */}
      {processingLog.length > 0 && (
        <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            処理ログ
          </h3>
          <div className="space-y-1 font-mono text-sm max-h-96 overflow-y-auto">
            {processingLog.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.startsWith("✓")
                    ? "text-green-600 dark:text-green-400"
                    : log.startsWith("✗")
                      ? "text-red-600 dark:text-red-400"
                      : log.includes("⚡")
                        ? "text-yellow-600 dark:text-yellow-400 font-bold"
                        : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              キャラクターの削除確認
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              キャラクター「{selectedCharacter}」を削除しますか？
              <br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={deleteCharacter}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一問一答セクション */}
      {philosophy && (
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            一問一答
          </h3>

          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            人格「{selectedCharacter}
            」に「発言」を投げることができます。あなたのことは感知しておらず、直前の発言を覚えることはありません。学習もされません。
          </div>

          {/* 会話履歴 */}
          {chatMessages.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`${message.role === "user" ? "text-right" : "text-left"}`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[80%] ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <div className="text-sm mb-1 font-medium opacity-70">
                        {message.role === "user" ? "あなた" : selectedCharacter}
                      </div>
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                      {message.metadata && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs opacity-70">
                          {message.metadata.emotional_tone && (
                            <div>感情: {message.metadata.emotional_tone}</div>
                          )}
                          {message.metadata.confidence !== undefined && (
                            <div>
                              確信度:{" "}
                              {(message.metadata.confidence * 100).toFixed(0)}%
                            </div>
                          )}
                          {message.metadata.trigger_detected && (
                            <div className="text-yellow-300">
                              ⚡ トリガー検出
                            </div>
                          )}
                          {message.metadata.taboo_detected && (
                            <div className="text-red-300">⚠️ タブー検出</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isChatProcessing && (
                  <div className="text-left">
                    <div className="inline-block p-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600">
                      <div className="text-sm mb-1 font-medium opacity-70">
                        {selectedCharacter}
                      </div>
                      <div className="flex space-x-1">
                        <span className="animate-bounce">●</span>
                        <span
                          className="animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        >
                          ●
                        </span>
                        <span
                          className="animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        >
                          ●
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 入力フォーム */}
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              type="text"
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              placeholder="質問を入力してください..."
              disabled={isChatProcessing}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={!currentQuestion.trim() || isChatProcessing}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                !currentQuestion.trim() || isChatProcessing
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              質問
            </button>
            {chatMessages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="px-4 py-3 rounded-lg font-medium transition-all border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                クリア
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
