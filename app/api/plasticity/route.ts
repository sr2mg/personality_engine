import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const age = parseInt(searchParams.get("age") || "0");
    const character = searchParams.get("character") || "default";

    // Read character-specific plasticity config
    const configPath = path.join(
      process.cwd(),
      "data",
      character,
      "plasticity_config.json"
    );

    let configData: string;
    try {
      configData = await fs.readFile(configPath, "utf-8");
    } catch (error) {
      // If character-specific config doesn't exist, try to create it from default
      const defaultConfigPath = path.join(
        process.cwd(),
        "data",
        "default",
        "plasticity_config.json"
      );
      try {
        configData = await fs.readFile(defaultConfigPath, "utf-8");
        // Create character directory if it doesn't exist
        const characterDir = path.join(process.cwd(), "data", character);
        await fs.mkdir(characterDir, { recursive: true });
        // Copy default config to character directory
        await fs.writeFile(configPath, configData);
      } catch (defaultError) {
        throw new Error(
          `Failed to load plasticity config for character '${character}': ${error}`
        );
      }
    }

    const config = JSON.parse(configData);
    const params = config.plasticity_model.parameters;

    // Calculate plasticity using the same logic as personalityEngine.ts
    const plasticity = calculatePlasticity(age, params);

    return NextResponse.json({
      plasticity,
      age,
      threshold: 70 / plasticity, // Dynamic threshold for creed updates
      character,
    });
  } catch (error) {
    console.error("Error calculating plasticity:", error);
    return NextResponse.json(
      { error: "Failed to calculate plasticity" },
      { status: 500 }
    );
  }
}

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
  const maturityAge = maturityPoint - youthPeriod;
  const scaleFactor = 0.7 / Math.exp(-decayRate * maturityAge);

  const plasticity = Math.max(decayFactor * scaleFactor, minPlasticity);
  return Math.min(plasticity, 1.0);
}
