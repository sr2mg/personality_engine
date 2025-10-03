import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error reading config:", error);
    return NextResponse.json(
      { error: "Failed to read configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, character = "default" } = body;

    // Validate the config structure
    if (!config.plasticity_model || !config.plasticity_model.parameters) {
      return NextResponse.json(
        { error: "Invalid configuration structure" },
        { status: 400 }
      );
    }

    // Ensure character directory exists
    const characterDir = path.join(process.cwd(), "data", character);
    await fs.mkdir(characterDir, { recursive: true });

    // Write the config to character-specific file with pretty formatting
    const configPath = path.join(characterDir, "plasticity_config.json");
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
