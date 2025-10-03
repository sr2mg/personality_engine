"use client";

import { useState, useEffect } from "react";

interface ConfigEditorProps {
  config: any;
  onSave: (config: any, character: string) => void;
}

export default function ConfigEditor({ config, onSave }: ConfigEditorProps) {
  const [editedConfig, setEditedConfig] = useState(config);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [characters, setCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState("default");

  useEffect(() => {
    setEditedConfig(config);
  }, [config]);

  useEffect(() => {
    // Load available characters
    fetch("/api/characters")
      .then((res) => res.json())
      .then((data) => setCharacters(data))
      .catch((error) => console.error("Failed to load characters:", error));
  }, []);

  useEffect(() => {
    // Load character-specific config when character changes
    if (selectedCharacter) {
      loadCharacterConfig(selectedCharacter);
    }
  }, [selectedCharacter]);

  const loadCharacterConfig = async (character: string) => {
    try {
      const response = await fetch(`/api/config?character=${character}`);
      if (response.ok) {
        const data = await response.json();
        setEditedConfig(data);
      }
    } catch (error) {
      console.error("Failed to load character config:", error);
    }
  };

  const handleParameterChange = (paramName: string, value: number) => {
    setEditedConfig({
      ...editedConfig,
      plasticity_model: {
        ...editedConfig.plasticity_model,
        parameters: {
          ...editedConfig.plasticity_model.parameters,
          [paramName]: {
            ...editedConfig.plasticity_model.parameters[paramName],
            value: value,
          },
        },
      },
    });
  };

  const applyPreset = (presetName: string) => {
    const preset = editedConfig.plasticity_model.presets[presetName];
    if (preset) {
      setEditedConfig({
        ...editedConfig,
        plasticity_model: {
          ...editedConfig.plasticity_model,
          parameters: {
            ...editedConfig.plasticity_model.parameters,
            youth_period_days: {
              ...editedConfig.plasticity_model.parameters.youth_period_days,
              value: preset.youth_period_days,
            },
            maturity_point_days: {
              ...editedConfig.plasticity_model.parameters.maturity_point_days,
              value: preset.maturity_point_days,
            },
            decay_rate: {
              ...editedConfig.plasticity_model.parameters.decay_rate,
              value: preset.decay_rate,
            },
          },
        },
      });
      setSelectedPreset(presetName);
    }
  };

  const handleSave = () => {
    onSave(editedConfig, selectedCharacter);
  };

  if (!editedConfig) return null;

  const params = editedConfig.plasticity_model.parameters;
  const presets = editedConfig.plasticity_model.presets;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        可塑性モデル設定
      </h2>

      {/* Character Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          キャラクター選択
        </label>
        <select
          value={selectedCharacter}
          onChange={(e) => setSelectedCharacter(e.target.value)}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {characters.map((character) => (
            <option key={character} value={character}>
              {character}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          キャラクターごとに異なる可塑性設定を管理できます
        </p>
      </div>

      {/* Preset Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          プリセット選択
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(presets).map(([name, preset]: [string, any]) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedPreset === name
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Parameter Editors */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          パラメータ調整
        </h3>

        {Object.entries(params).map(([paramName, param]: [string, any]) => (
          <div key={paramName} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {paramName
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </label>
              <span className="text-sm font-mono text-gray-900 dark:text-white">
                {param.value}
              </span>
            </div>
            <input
              type="range"
              min={
                paramName === "decay_rate"
                  ? 0.001
                  : paramName === "minimum_plasticity"
                    ? 0.01
                    : 1
              }
              max={
                paramName === "decay_rate"
                  ? 0.1
                  : paramName === "minimum_plasticity"
                    ? 0.5
                    : 3650
              }
              step={
                paramName === "decay_rate" || paramName === "minimum_plasticity"
                  ? 0.001
                  : 1
              }
              value={param.value}
              onChange={(e) =>
                handleParameterChange(paramName, parseFloat(e.target.value))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {param.description}
            </p>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          設定を保存
        </button>
      </div>

      {/* JSON Preview */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          JSON プレビュー
        </h3>
        <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
          <code className="text-gray-800 dark:text-gray-200">
            {JSON.stringify(editedConfig, null, 2)}
          </code>
        </pre>
      </div>
    </div>
  );
}
