import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { generateObject } from "ai";
import { PhilosophyManager } from "../../components/philosophyManager";

export async function POST(request: NextRequest) {
  try {
    const { question, characterName = "default" } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: "質問が入力されていません" },
        { status: 400 }
      );
    }

    // PhilosophyManagerでphilosophyデータを読み込む
    const manager = new PhilosophyManager(characterName);
    const philosophy = manager.loadPhilosophy();

    const llm = google("gemini-2.5-flash");

    // philosophyのスタンスを文字で説明
    const economicStance =
      philosophy.stance.economic_left_right < -0.5
        ? "左派的"
        : philosophy.stance.economic_left_right > 0.5
          ? "右派的"
          : "中道的";

    const socialStance =
      philosophy.stance.social_liberal_conservative < -0.5
        ? "保守的"
        : philosophy.stance.social_liberal_conservative > 0.5
          ? "リベラル"
          : "中道的";

    // 認知バイアスの説明
    const biasDescription = [];
    if (philosophy.bias.confirmation > 0.6) {
      biasDescription.push("自分の信念を裏付ける情報を重視する傾向がある");
    }
    if (philosophy.bias.recency > 0.6) {
      biasDescription.push("最近の出来事を重視する傾向がある");
    }
    if (philosophy.bias.change_resistance > 0.6) {
      biasDescription.push("変化に抵抗する傾向がある");
    }

    const prompt = `
あなたは以下のような人格・信念を持つキャラクターです。

【基本信念】
${philosophy.creed}

【立場】
- 経済観: ${economicStance} (数値: ${philosophy.stance.economic_left_right})
- 社会観: ${socialStance} (数値: ${philosophy.stance.social_liberal_conservative})

【認知の傾向】
- 確証バイアス: ${philosophy.bias.confirmation} (0=弱い, 1=強い)
- 新近性バイアス: ${philosophy.bias.recency} (0=弱い, 1=強い)
- 変化抵抗: ${philosophy.bias.change_resistance} (0=弱い, 1=強い)
${biasDescription.length > 0 ? `\n特徴: ${biasDescription.join("、")}` : ""}

【反応しやすいキーワード】
トリガー: ${philosophy.hooks.triggers.length > 0 ? philosophy.hooks.triggers.join(", ") : "特になし"}
タブー: ${philosophy.hooks.taboos.length > 0 ? philosophy.hooks.taboos.join(", ") : "特になし"}

【年齢（経験日数）】
${philosophy.age_in_days}日

あなたは今、試験管の中にいます。試験管の外から質問が来ます。
質問主について、誰かはあなたは認識することができませんが、発話することはできます。
なお、認知傾向や立場に基づいて、発話拒否をしても構いません。その場合は「（発話拒否）」と発話してください。
上記の人格・信念に基づいて、以下の質問に答えてください。
自分の信念や立場を反映させて、一貫性のある回答をしてください。

質問: ${question}
`;

    const { object } = await generateObject({
      model: llm,
      prompt: prompt,
      schema: z.object({
        answer: z
          .string()
          .describe(
            "質問に対する回答。キャラクターの人格や信念を反映させた、自然な会話形式の返答"
          ),
        thought_process: z
          .string()
          .describe("回答を導き出すまでの思考プロセス（内部的な考察）"),
        emotional_tone: z
          .enum(["positive", "neutral", "negative", "passionate", "defensive"])
          .describe("回答時の感情的なトーン"),
        confidence: z.number().min(0).max(1).describe("回答への確信度（0-1）"),
      }),
    });

    // トリガーワードが質問に含まれているかチェック
    let triggerDetected = false;
    let tabooDetected = false;

    for (const trigger of philosophy.hooks.triggers) {
      if (question.toLowerCase().includes(trigger.toLowerCase())) {
        triggerDetected = true;
        break;
      }
    }

    for (const taboo of philosophy.hooks.taboos) {
      if (question.toLowerCase().includes(taboo.toLowerCase())) {
        tabooDetected = true;
        break;
      }
    }

    // 回答の調整（トリガーやタブーに反応）
    let adjustedAnswer = object.answer;
    if (triggerDetected) {
      adjustedAnswer = `（強い関心を示しながら）${object.answer}`;
    } else if (tabooDetected) {
      adjustedAnswer = `（やや不快感を示しながら）${object.answer}`;
    }

    return NextResponse.json({
      answer: adjustedAnswer,
      metadata: {
        emotional_tone: object.emotional_tone,
        confidence: object.confidence,
        thought_process: object.thought_process,
        trigger_detected: triggerDetected,
        taboo_detected: tabooDetected,
        character: characterName,
        philosophy: {
          creed: philosophy.creed,
          stance: philosophy.stance,
          age_in_days: philosophy.age_in_days,
        },
      },
    });
  } catch (error) {
    console.error("Error in chat with personality:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to generate response", details: errorMessage },
      { status: 500 }
    );
  }
}
