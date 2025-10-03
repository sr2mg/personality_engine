import { NextRequest, NextResponse } from "next/server";
import { PhilosophyManager } from "../../components/philosophyManager";

export async function GET(request: NextRequest) {
  try {
    // Get character name from query parameters
    const searchParams = request.nextUrl.searchParams;
    const characterName = searchParams.get("character") || "default";

    // Migrate existing philosophy if needed (only runs once)
    PhilosophyManager.migrateExistingPhilosophy();

    // Create manager for the specified character
    const manager = new PhilosophyManager(characterName);
    const philosophy = manager.loadPhilosophy();

    return NextResponse.json(philosophy);
  } catch (error) {
    console.error("Error reading philosophy:", error);
    return NextResponse.json(
      { error: "Failed to read philosophy" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { philosophy, characterName = "default" } = await request.json();

    // Create manager for the specified character
    const manager = new PhilosophyManager(characterName);

    // Use the rotation system to save philosophy
    manager.rotateGenerations(philosophy);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error writing philosophy:", error);
    return NextResponse.json(
      { error: "Failed to save philosophy" },
      { status: 500 }
    );
  }
}
