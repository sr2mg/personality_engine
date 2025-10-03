import { NextRequest, NextResponse } from "next/server";
import { PhilosophyManager } from "../../../components/philosophyManager";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { character: string } }
) {
  try {
    const characterName = params.character;

    if (characterName === "default") {
      return NextResponse.json(
        { error: "defaultキャラクターは削除できません" },
        { status: 400 }
      );
    }

    const success = PhilosophyManager.deleteCharacter(characterName);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "キャラクターの削除に失敗しました" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting character:", error);
    return NextResponse.json(
      { error: "キャラクター削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
