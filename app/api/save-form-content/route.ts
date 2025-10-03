import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { formTitle, content } = await request.json();

    // Ensure persona_materials directory exists
    const personaMaterialsDir = path.join(process.cwd(), "persona_materials");
    await fs.mkdir(personaMaterialsDir, { recursive: true });

    // Create filename from form title
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    // 日本語を含むファイル名をサポート - 危険な文字のみを置換
    const safeTitle = formTitle.replace(/[<>:"/\\|?*]/g, "_");
    const fileName = `text_${safeTitle}_${timestamp}.txt`;

    // Save the file
    const filePath = path.join(personaMaterialsDir, fileName);
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ success: true, fileName });
  } catch (error) {
    console.error("Error saving form content:", error);
    return NextResponse.json(
      { error: "Failed to save form content" },
      { status: 500 }
    );
  }
}
