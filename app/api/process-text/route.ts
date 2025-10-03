import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject } from "ai";
import {
  PhilosophyManager,
  Philosophy,
} from "../../components/philosophyManager";

// Helper function to count keyword hits
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

// Helper function to clamp values
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Calculate plasticity
function calculatePlasticity(age: number, params: any): number {
  const youthPeriod = params.youth_period_days.value;
  const maturityPoint = params.maturity_point_days.value;
  const decayRate = params.decay_rate.value;
  const minPlasticity = params.minimum_plasticity.value;

  if (age <= youthPeriod) {
    return 1.0;
  }

  const ageAfterYouth = age - youthPeriod;
  const decayFactor = Math.exp(-decayRate * ageAfterYouth);
  const maturityAge = maturityPoint - youthPeriod;
  const scaleFactor = 0.7 / Math.exp(-decayRate * maturityAge);

  const plasticity = Math.max(decayFactor * scaleFactor, minPlasticity);
  return Math.min(plasticity, 1.0);
}

// Update bias function
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

export async function POST(request: NextRequest) {
  try {
    const {
      fileName,
      philosophy,
      characterName = "default",
    } = await request.json();

    // Read the text file
    const filePath = path.join(process.cwd(), "persona_materials", fileName);
    const textContent = await fs.readFile(filePath, "utf-8");

    // Read plasticity config
    const configPath = path.join(
      process.cwd(),
      "data",
      characterName,
      "plasticity_config.json"
    );
    const configData = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configData);
    const plasticityParams = config.plasticity_model.parameters;

    // Create a copy of philosophy for processing
    let currentPhilosophy: Philosophy = JSON.parse(JSON.stringify(philosophy));

    // Increment age and calculate plasticity
    currentPhilosophy.age_in_days = (currentPhilosophy.age_in_days || 0) + 1;
    const plasticity = calculatePlasticity(
      currentPhilosophy.age_in_days,
      plasticityParams
    );

    // Count trigger and taboo hits
    const triggerHits = countHits(
      textContent,
      currentPhilosophy.hooks.triggers
    );
    const tabooHits = countHits(textContent, currentPhilosophy.hooks.taboos);

    const llm = google("gemini-2.5-flash");

    // First analysis prompt
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
    ${textContent}
    ---
    
    このテキストを読んだ後、以下のような質問に答えてください。
    なお、情緒の揺れが極端に大きかった場合、立場や信念はさらに変わりやすい可能性があります。
    `;

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

    // Second analysis prompt - entering the world
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
        
        テキスト：${textContent}
        
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
        economicAxisDelta: z
          .number()
          .describe("経済観の変化量。-1から+1の範囲"),
        socialAxisDelta: z.number().describe("社会観の変化量。-1から+1の範囲"),
        disagreeFactor: z
          .number()
          .describe("現在の立場との不一致度。0（完全一致）から1（完全不一致）"),
        evidenceStrength: z.number().describe("提示された証拠の強さ。0から1"),
      }),
    });

    // Adjust arousal with triggers/taboos
    const adjustedArousal =
      change_object.fix_arousal + triggerHits * 10 - tabooHits * 10;

    // Update stances
    const recencyBoost = 0.3;

    // Economic axis update
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

    // Social axis update
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

    // Update biases with plasticity
    currentPhilosophy.bias = updateBias(currentPhilosophy.bias, {
      arousal: adjustedArousal,
      disagree: change_object.disagreeFactor,
      evidence: change_object.evidenceStrength,
      plasticity: plasticity,
    });

    // Gradual hardening of change resistance
    currentPhilosophy.bias.change_resistance = clamp(
      currentPhilosophy.bias.change_resistance + 0.001,
      0,
      1
    );

    // Dynamic arousal threshold based on plasticity
    const dynamicArousalThreshold = 70 / plasticity;

    // Check if creed should be updated
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

    let philosophyUpdated = false;
    if (
      creedUpdateObject.shouldUpdateCreed &&
      adjustedArousal >= dynamicArousalThreshold
    ) {
      if (
        creedUpdateObject.updatedCreed &&
        creedUpdateObject.updatedCreed.trim() !== ""
      ) {
        currentPhilosophy.creed = creedUpdateObject.updatedCreed;
        philosophyUpdated = true;

        // Reset age on major change
        const oldAge = currentPhilosophy.age_in_days;
        currentPhilosophy.age_in_days = Math.max(Math.floor(oldAge / 2), 30);
      }
    }

    // Check if creed needs shrinking
    const CREED_MAX_LEN = 200;
    const CREED_MAX_SENT = 2;
    const sentenceCount = currentPhilosophy.creed
      .split("。")
      .filter(Boolean).length;
    const isShrinked =
      currentPhilosophy.creed.length > CREED_MAX_LEN ||
      sentenceCount > CREED_MAX_SENT;

    if (isShrinked) {
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
      currentPhilosophy.creed = summary;
    }

    // Save philosophy using PhilosophyManager
    const manager = new PhilosophyManager(characterName);
    manager.rotateGenerations(currentPhilosophy);
    manager.cleanupArchive(30);

    // Create response
    const result = {
      impressionAfterReading: fix_object.impressionAfterReading,
      thoughts: fix_object.thoughts,
      worldExperience: {
        description: change_object.description,
        your_impression: change_object.your_impression,
        fix_arousal: change_object.fix_arousal,
        economicAxisDelta: change_object.economicAxisDelta,
        socialAxisDelta: change_object.socialAxisDelta,
      },
      philosophyUpdated: philosophyUpdated,
      newPhilosophy: currentPhilosophy,
      plasticity: plasticity,
      dynamicArousalThreshold: dynamicArousalThreshold,
      creedUpdateReason: creedUpdateObject.updateReason,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing text:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to process text", details: errorMessage },
      { status: 500 }
    );
  }
}
