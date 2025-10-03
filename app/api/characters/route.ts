import { NextResponse } from "next/server";
import { PhilosophyManager } from "../../components/philosophyManager";

export async function GET() {
  try {
    // Migrate existing philosophy if needed (only runs once)
    PhilosophyManager.migrateExistingPhilosophy();

    // Get list of available characters
    const characters = PhilosophyManager.getAvailableCharacters();

    // If no characters exist, ensure default exists
    if (characters.length === 0) {
      const defaultManager = new PhilosophyManager("default");
      defaultManager.loadPhilosophy(); // This will create default if it doesn't exist
      return NextResponse.json(["default"]);
    }

    return NextResponse.json(characters);
  } catch (error) {
    console.error("Error getting characters:", error);
    return NextResponse.json(
      { error: "Failed to get characters" },
      { status: 500 }
    );
  }
}
