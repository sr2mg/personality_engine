import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { fileName, content } = await request.json();

    // Ensure persona_materials directory exists
    const personaMaterialsDir = path.join(process.cwd(), "persona_materials");
    await fs.mkdir(personaMaterialsDir, { recursive: true });

    // Save the file
    const filePath = path.join(personaMaterialsDir, fileName);
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ success: true, fileName });
  } catch (error) {
    console.error("Error saving uploaded file:", error);
    return NextResponse.json(
      { error: "Failed to save uploaded file" },
      { status: 500 }
    );
  }
}
