import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 画像アップロード用のAPI
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;
    const characterName = formData.get("characterName") as string;

    if (!file || !characterName) {
      return NextResponse.json(
        { error: "画像またはキャラクター名が指定されていません" },
        { status: 400 }
      );
    }

    // ファイルの拡張子を取得
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension || "")) {
      return NextResponse.json(
        { error: "サポートされていない画像形式です（jpg, png, gif, webpのみ）" },
        { status: 400 }
      );
    }

    // 画像を保存するディレクトリ
    const profileImagesDir = path.join(process.cwd(), "public", "profile-images");
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(profileImagesDir)) {
      fs.mkdirSync(profileImagesDir, { recursive: true });
    }

    // ファイル名を生成（キャラクター名 + 拡張子）
    const fileName = `${characterName}.${fileExtension}`;
    const filePath = path.join(profileImagesDir, fileName);

    // 既存のファイルがあれば削除（拡張子が異なる可能性があるため）
    const existingFiles = fs.readdirSync(profileImagesDir);
    existingFiles.forEach((existingFile) => {
      if (existingFile.startsWith(`${characterName}.`)) {
        fs.unlinkSync(path.join(profileImagesDir, existingFile));
      }
    });

    // ファイルを保存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      imagePath: `/profile-images/${fileName}`,
    });
  } catch (error) {
    console.error("画像アップロードエラー:", error);
    return NextResponse.json(
      { error: "画像のアップロードに失敗しました" },
      { status: 500 }
    );
  }
}

// 画像を取得するAPI
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const characterName = searchParams.get("character");

    if (!characterName) {
      return NextResponse.json(
        { error: "キャラクター名が指定されていません" },
        { status: 400 }
      );
    }

    const profileImagesDir = path.join(process.cwd(), "public", "profile-images");

    if (!fs.existsSync(profileImagesDir)) {
      return NextResponse.json({ imagePath: null });
    }

    // キャラクター名で始まるファイルを検索
    const files = fs.readdirSync(profileImagesDir);
    const imageFile = files.find((file) => file.startsWith(`${characterName}.`));

    if (imageFile) {
      return NextResponse.json({
        imagePath: `/profile-images/${imageFile}`,
      });
    }

    return NextResponse.json({ imagePath: null });
  } catch (error) {
    console.error("画像取得エラー:", error);
    return NextResponse.json(
      { error: "画像の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 画像を削除するAPI
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const characterName = searchParams.get("character");

    if (!characterName) {
      return NextResponse.json(
        { error: "キャラクター名が指定されていません" },
        { status: 400 }
      );
    }

    const profileImagesDir = path.join(process.cwd(), "public", "profile-images");

    if (!fs.existsSync(profileImagesDir)) {
      return NextResponse.json({ success: true });
    }

    // キャラクター名で始まるファイルを削除
    const files = fs.readdirSync(profileImagesDir);
    let deleted = false;

    files.forEach((file) => {
      if (file.startsWith(`${characterName}.`)) {
        fs.unlinkSync(path.join(profileImagesDir, file));
        deleted = true;
      }
    });

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error("画像削除エラー:", error);
    return NextResponse.json(
      { error: "画像の削除に失敗しました" },
      { status: 500 }
    );
  }
}
