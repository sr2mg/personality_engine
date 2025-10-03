import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

const PERSONA_MATERIALS_DIR = path.join(process.cwd(), "persona_materials");

export async function GET() {
  try {
    // Check if persona_materials directory exists
    try {
      await fs.access(PERSONA_MATERIALS_DIR);
    } catch {
      // Create directory if it doesn't exist
      await fs.mkdir(PERSONA_MATERIALS_DIR, { recursive: true });

      // Create a sample file
      const sampleContent = `これはサンプルテキストです。
人格形成エンジンのテストに使用できます。
このテキストを読むことで、AIの人格がどのように変化するかを観察できます。`;

      await fs.writeFile(
        path.join(PERSONA_MATERIALS_DIR, "sample.txt"),
        sampleContent,
        "utf-8"
      );
    }

    // Read all txt and md files from the directory
    const files = await fs.readdir(PERSONA_MATERIALS_DIR);
    const validFiles = files.filter(
      (file) => file.endsWith(".txt") || file.endsWith(".md")
    );

    // Get file details including content
    const materials = await Promise.all(
      validFiles.map(async (fileName) => {
        const filePath = path.join(PERSONA_MATERIALS_DIR, fileName);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf-8");

        return {
          name: fileName,
          content,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      })
    );

    return NextResponse.json({ files: validFiles, materials });
  } catch (error) {
    console.error("Error reading persona materials:", error);
    return NextResponse.json(
      { error: "Failed to read persona materials" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { fileName } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
    }

    // Validate file name to prevent directory traversal
    if (
      fileName.includes("..") ||
      fileName.includes("/") ||
      fileName.includes("\\")
    ) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    // Check if file exists
    const filePath = path.join(PERSONA_MATERIALS_DIR, fileName);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete the file
    await fs.unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting persona material:", error);
    return NextResponse.json(
      { error: "Failed to delete persona material" },
      { status: 500 }
    );
  }
}
