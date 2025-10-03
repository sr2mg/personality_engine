import { openai } from "@ai-sdk/openai";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { generateObject } from "ai";
import { config } from "dotenv";
import { PhilosophyManager, Philosophy } from "./philosophyManager";
import { google } from "@ai-sdk/google";

config({ path: ".env.development" });
if (process.stdout.isTTY) {
  process.stdout.setEncoding("utf8");
}

// 新しいPhilosophyフォーマットの型定義
const PhilosophySchema = z.object({
  version: z.string(),
  creed: z.string(),
  age_in_days: z.number().default(0), // 哲学の年齢（日数）
  stance: z.object({
    economic_left_right: z.number().min(-1).max(1),
    social_liberal_conservative: z.number().min(-1).max(1),
  }),
  bias: z.object({
    confirmation: z.number().min(0).max(1),
    recency: z.number().min(0).max(1),
    change_resistance: z.number().min(0).max(1),
  }),
  hooks: z.object({
    triggers: z.array(z.string()),
    taboos: z.array(z.string()),
  }),
});
const updateBias = (
  bias: Philosophy["bias"],
  {
    arousal,
    disagree,
    evidence,
    plasticity,
  }: {
    arousal: number;
    disagree: number;
    evidence: number;
    plasticity?: number;
  }
) => {
  const newBias = { ...bias };
  // 学習率
  const LR = 0.05;

  // 1. 確証バイアス：反証×高アラウザルで強化
  if (disagree >= 0.6 && arousal >= 60) {
    newBias.confirmation = clamp(newBias.confirmation + LR * evidence, 0, 1);
  }
  // 反証×低アラウザル → わずかに柔軟化
  if (disagree >= 0.6 && arousal < 40) {
    newBias.confirmation = clamp(newBias.confirmation - LR * evidence, 0, 1);
  }

  // 2. 新近性バイアス：高アラウザル記事が連続すれば徐々に上昇
  if (arousal >= 70) {
    newBias.recency = clamp(newBias.recency + LR * 0.5, 0, 1);
  } else {
    // 静かな記事は忘却を促進
    newBias.recency = clamp(newBias.recency - LR * 0.2, 0, 1);
  }

  // 3. 変化抵抗：可塑性が提供されていない場合は従来の処理
  if (plasticity === undefined) {
    // creed が動いた直後だけ手動で+0.1済みなら、ここでは緩やかに減衰
    newBias.change_resistance = clamp(
      newBias.change_resistance - LR * 0.1,
      0,
      1
    );
  }
  return newBias;
};

// type Philosophy = z.infer<typeof PhilosophySchema>; // philosophyManager.tsから import するため不要

// ヘルパー関数：値を指定範囲内に制限
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ヘルパー関数：テキスト内のキーワードヒット数をカウント
function countHits(text: string, keywords: string[]): number {
  let count = 0;
  for (const keyword of keywords) {
    const regex = new RegExp(keyword, "gi");
    const matches = text.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

// persona_materialsディレクトリ内のテキストファイルとMarkdownファイルを取得
const personaMaterialsDir = "./persona_materials";
const targetFiles = fs
  .readdirSync(personaMaterialsDir)
  .filter((file) => file.endsWith(".txt") || file.endsWith(".md"))
  .map((file) => path.join(personaMaterialsDir, file));

// 哲学のjson
const philosophy_file_path = "./data/philosophy.json";
const philosophyData = JSON.parse(
  fs.readFileSync(philosophy_file_path, "utf-8")
);

// 型検証
const philosophy: Philosophy = PhilosophySchema.parse(philosophyData);

// 可塑性設定の読み込み関数
function loadPlasticityConfig(character: string = "default") {
  const plasticityConfigPath = `./data/${character}/plasticity_config.json`;
  try {
    return JSON.parse(fs.readFileSync(plasticityConfigPath, "utf-8"));
  } catch (error) {
    // キャラクター固有の設定がない場合はdefaultを使用
    const defaultConfigPath = "./data/default/plasticity_config.json";
    try {
      const defaultConfig = JSON.parse(
        fs.readFileSync(defaultConfigPath, "utf-8")
      );
      // キャラクターディレクトリを作成してデフォルト設定をコピー
      const characterDir = `./data/${character}`;
      if (!fs.existsSync(characterDir)) {
        fs.mkdirSync(characterDir, { recursive: true });
      }
      fs.writeFileSync(
        plasticityConfigPath,
        JSON.stringify(defaultConfig, null, 2)
      );
      return defaultConfig;
    } catch (defaultError) {
      throw new Error(
        `Failed to load plasticity config for character '${character}': ${error}`
      );
    }
  }
}

// デフォルトキャラクターの可塑性設定を読み込み
const plasticityConfig = loadPlasticityConfig("default");
const plasticityParams = plasticityConfig.plasticity_model.parameters;

console.log("--哲学データを読み込みます--");
console.log(philosophy);
console.log("--可塑性設定--");
console.log(`若年期: ${plasticityParams.youth_period_days.value}日`);
console.log(`成熟点: ${plasticityParams.maturity_point_days.value}日`);
console.log(`減衰率: ${plasticityParams.decay_rate.value}`);

// 処理中の哲学データのコピーを作成
let currentPhilosophy: Philosophy = JSON.parse(JSON.stringify(philosophy));

// 可塑性計算関数
function calculatePlasticity(age: number, params: any): number {
  const youthPeriod = params.youth_period_days.value;
  const maturityPoint = params.maturity_point_days.value;
  const decayRate = params.decay_rate.value;
  const minPlasticity = params.minimum_plasticity.value;

  if (age <= youthPeriod) {
    // 若年期は最大可塑性を維持
    return 1.0;
  }

  // 若年期後の減衰計算
  const ageAfterYouth = age - youthPeriod;
  const decayFactor = Math.exp(-decayRate * ageAfterYouth);

  // 成熟点で閾値が100になるように調整
  // 70 / plasticity = 100 at maturityPoint
  // plasticity = 0.7 at maturityPoint
  const maturityAge = maturityPoint - youthPeriod;
  const scaleFactor = 0.7 / Math.exp(-decayRate * maturityAge);

  const plasticity = Math.max(decayFactor * scaleFactor, minPlasticity);
  return Math.min(plasticity, 1.0);
}

for (const filePath of targetFiles) {
  // ループ冒頭で年齢を増加させ、可塑性を計算
  currentPhilosophy.age_in_days = (currentPhilosophy.age_in_days ?? 0) + 1;
  const plasticity = calculatePlasticity(
    currentPhilosophy.age_in_days,
    plasticityParams
  );

  console.log(`--ファイルを読み込みます: ${filePath}--`);
  console.log(
    `哲学の年齢: ${currentPhilosophy.age_in_days}日, 可塑性: ${plasticity.toFixed(4)}`
  );
  const text_content = fs.readFileSync(filePath, "utf-8");

  // テキスト内のトリガーとタブーのヒット数を計算
  const triggerHits = countHits(text_content, currentPhilosophy.hooks.triggers);
  const tabooHits = countHits(text_content, currentPhilosophy.hooks.taboos);

  const llm = google("gemini-2.5-flash");

  const fix_prompt = `
  以下のような信念と立場を持つあなたはあるテキストを読みました。
  
  中心的信念: ${currentPhilosophy.creed}
  
  政治的立場:
  - 経済観 (左派-1～右派+1): ${currentPhilosophy.stance.economic_left_right}
  - 社会観 (保守-1～リベラル+1): ${currentPhilosophy.stance.social_liberal_conservative}
  
  認知バイアス:
  - 確証バイアス: ${currentPhilosophy.bias.confirmation}
  - 新近性バイアス: ${currentPhilosophy.bias.recency}
  - 変化抵抗: ${currentPhilosophy.bias.change_resistance}
  
  反応トリガー: ${currentPhilosophy.hooks.triggers.join(", ")}
  タブー: ${currentPhilosophy.hooks.taboos.join(", ")}
  
  テキスト内でトリガーワードが${triggerHits}回、タブーワードが${tabooHits}回検出されました。
  
  テキストは以下です。
  ---
  ${text_content}
  ---
  
  このテキストを読んだ後、以下のような質問に答えてください。
  なお、情緒の揺れが極端に大きかった場合、立場や信念はさらに変わりやすい可能性があります。
  `;

  console.log("--テキストを読んだ後の反応を分析します--");
  const { object: fix_object } = await generateObject({
    model: llm,
    prompt: fix_prompt,
    schema: z.object({
      impressionAfterReading: z
        .string()
        .describe(
          "読後の実感。嬉しかったか、悲しかったか、痛みを伴ったか等といった、言語化しづらい表現"
        ),
      thoughts: z.string().describe("思ったこと"),
    }),
  });

  console.log("--今から世界の中に入ります--");
  const { object: change_object } = await generateObject({
    model: llm,
    prompt: `
      以下のような信念と立場を持つあなたはあるテキストを読みました。
      
      中心的信念: ${currentPhilosophy.creed}
      経済観: ${currentPhilosophy.stance.economic_left_right}
      社会観: ${currentPhilosophy.stance.social_liberal_conservative}
      
      認知バイアス:
      - 確証バイアス: ${currentPhilosophy.bias.confirmation}
      - 新近性バイアス: ${currentPhilosophy.bias.recency}
      - 変化抵抗: ${currentPhilosophy.bias.change_resistance}
      
      テキスト：${text_content}
      
      その結果、下記のような感想になりました。
      読後の実感：${fix_object.impressionAfterReading}
      思ったこと：${fix_object.thoughts}

      
      あなたはこれからこのテキストの世界に実際に入ることになりました。上記の分析結果を踏まえて、そこで見た情景を主観的に、そしてその世界に入って思ったことを詳細に記述してください。
      体験によって経済観や社会観、情緒の揺れがどのように変化したかを反映させてください。
      `,
    schema: z.object({
      description: z
        .string()
        .describe("主観的に見てそのテキストの中の世界で起きたこと"),
      your_impression: z
        .string()
        .describe(
          "その世界でどのようなことを体験し、どのようなことを強く実感としてもったか"
        ),
      fix_arousal: z
        .number()
        .describe(
          "世界に入った後の情緒の揺れの強さ。0から100までのintで評価。70で「人生において10年以上覚えているであろう、強く影響されそうな出来事」くらいとする。"
        ),
      economicAxisDelta: z.number().describe("経済観の変化量。-1から+1の範囲"),
      socialAxisDelta: z.number().describe("社会観の変化量。-1から+1の範囲"),
      disagreeFactor: z
        .number()
        .describe("現在の立場との不一致度。0（完全一致）から1（完全不一致）"),
      evidenceStrength: z.number().describe("提示された証拠の強さ。0から1"),
    }),
  });
  console.log(change_object);

  console.log("--世界から帰ってきました。立場を更新します--");

  // Arousalをトリガー/タブーで補正
  const adjustedArousal =
    change_object.fix_arousal + triggerHits * 10 - tabooHits * 10;
  // スタンスの更新計算
  const recencyBoost = 0.3; // 新近性ブースト係数

  // 経済軸の更新
  const economicBase = change_object.economicAxisDelta;
  const economicConfAdj =
    economicBase *
    (1 - currentPhilosophy.bias.confirmation * change_object.disagreeFactor);
  const economicRecAdj =
    economicConfAdj * (1 + currentPhilosophy.bias.recency * recencyBoost);
  const economicFinalDelta =
    economicRecAdj * (1 - currentPhilosophy.bias.change_resistance);

  currentPhilosophy.stance.economic_left_right = clamp(
    currentPhilosophy.stance.economic_left_right + economicFinalDelta,
    -1,
    1
  );

  // 社会軸の更新
  const socialBase = change_object.socialAxisDelta;
  const socialConfAdj =
    socialBase *
    (1 - currentPhilosophy.bias.confirmation * change_object.disagreeFactor);
  const socialRecAdj =
    socialConfAdj * (1 + currentPhilosophy.bias.recency * recencyBoost);
  const socialFinalDelta =
    socialRecAdj * (1 - currentPhilosophy.bias.change_resistance);

  currentPhilosophy.stance.social_liberal_conservative = clamp(
    currentPhilosophy.stance.social_liberal_conservative + socialFinalDelta,
    -1,
    1
  );
  // バイアスの更新（可塑性を渡す）
  currentPhilosophy.bias = updateBias(currentPhilosophy.bias, {
    arousal: adjustedArousal,
    disagree: change_object.disagreeFactor,
    evidence: change_object.evidenceStrength,
    plasticity: plasticity,
  });

  // bias.change_resistance の緩慢な硬化（日ごとに0.001ずつ増加）
  currentPhilosophy.bias.change_resistance = clamp(
    currentPhilosophy.bias.change_resistance + 0.001,
    0,
    1
  );

  // hooksの更新

  // creed更新判定に使う閾値を可塑性でスケール
  const dynamicArousalThreshold = 70 / plasticity;
  console.log(
    `動的閾値: ${dynamicArousalThreshold.toFixed(2)} (基準値70 / 可塑性${plasticity.toFixed(4)})`
  );

  // 信念（creed）の更新を検討
  const { object: creedUpdateObject } = await generateObject({
    model: llm,
    prompt: `
      あなたは「creed 管理エージェント」。
      ### creed とは
      - 人格の核心を 1 – 2 文で要約した短い信条。
      - めったに変わらない。変更は "アイデンティティ転換" 級の出来事のみ。
      - creed を改定する場合は、 **既存文を保持したまま 1 文だけ追記** することを優先せよ。
      - 1 文追記で表現しきれない時だけ全面置換を検討せよ。

      現在の中心的信念: ${currentPhilosophy.creed}
      新しい経済観: ${currentPhilosophy.stance.economic_left_right}（変化量: ${economicFinalDelta}）
      新しい社会観: ${currentPhilosophy.stance.social_liberal_conservative}（変化量: ${socialFinalDelta}）
      
      テキストを読んだ際の分析：
      - 読後の実感：${fix_object.impressionAfterReading}
      - 思ったこと：${fix_object.thoughts}

      
      体験した世界: ${change_object.description}
      
      その世界での実感: ${change_object.your_impression}
      - 情緒の揺れの強さ: ${adjustedArousal}
      - 経済観の変化量：${change_object.economicAxisDelta}
      - 社会観の変化量：${change_object.socialAxisDelta}
      
      この体験と新しい立場を踏まえて、中心的信念を更新すべきか検討してください。
      大きな体験（情緒の揺れが${dynamicArousalThreshold.toFixed(0)}以上）の場合のみ、信念の一部を修正してください。
      `,
    schema: z.object({
      shouldUpdateCreed: z.boolean().describe("信念を更新すべきか"),
      updatedCreed: z
        .string()
        .describe(
          "更新後の信念。更新するときのみ **120 文字・ 2 文以内**。更新しない場合は空文字"
        ),
      updateReason: z.string().describe("更新理由または更新しない理由"),
    }),
  });

  if (
    creedUpdateObject.shouldUpdateCreed &&
    adjustedArousal >= dynamicArousalThreshold
  ) {
    // 空文字チェックを追加
    console.log("更新条件を満たしました。");
    console.log("更新後の信念:", creedUpdateObject.updatedCreed);
    if (
      creedUpdateObject.updatedCreed &&
      creedUpdateObject.updatedCreed.trim() !== ""
    ) {
      currentPhilosophy.creed = creedUpdateObject.updatedCreed;
      console.log("信念を更新しました:", creedUpdateObject.updateReason);

      // 重大イベントリセット：creedが置換されたら年齢を半分に（最小30日）
      const oldAge = currentPhilosophy.age_in_days;
      currentPhilosophy.age_in_days = Math.max(Math.floor(oldAge / 2), 30);
      console.log(
        `重大イベントにより哲学が若返りました: ${oldAge}日 → ${currentPhilosophy.age_in_days}日`
      );
    } else {
      console.log(
        "信念の更新が提案されましたが、新しい信念が空のため現在の信念を維持します"
      );
      console.log("更新理由:", creedUpdateObject.updateReason);
    }
  } else {
    console.log("信念の更新条件を満たしませんでした。");
    console.log("情緒の揺れの強さ:", adjustedArousal);
    console.log("理由:", creedUpdateObject.updateReason);
  }
  console.log("更新後の哲学:", currentPhilosophy);
  // もし長過ぎたらshrinkする
  const CREED_MAX_LEN = 200;
  const CREED_MAX_SENT = 2;
  const sentenceCount = currentPhilosophy.creed
    .split("。")
    .filter(Boolean).length;
  const isShrinked =
    currentPhilosophy.creed.length > CREED_MAX_LEN ||
    sentenceCount > CREED_MAX_SENT;
  if (isShrinked) {
    // ― 要約プロンプト ―
    const prompt = `
        次の creed を 1 文・150 字以内に抽象化して言い換えろ。
        ---
        ${currentPhilosophy.creed}
        ---
      `;
    const {
      object: { summary },
    } = await generateObject({
      model: llm,
      prompt,
      schema: z.object({ summary: z.string() }),
    });
    console.log("信念を縮小しました:", summary);
    currentPhilosophy.creed = summary;
  }
}

console.log("全てのテキストを読み終わりました。");
console.log("最終的な哲学:", currentPhilosophy);

// PhilosophyManagerを使用して3世代管理で保存
const manager = new PhilosophyManager();
manager.rotateGenerations(currentPhilosophy);
manager.showDiff();
manager.showGenerationStatus();

// 30日以上前のアーカイブをクリーンアップ
manager.cleanupArchive(30);

console.log("最新の哲学データを保存しました。");
