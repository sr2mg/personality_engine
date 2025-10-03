import fs from "fs";
import path from "path";
import { z } from "zod";

// PhilosophySchemaの型定義（personalityEngine.tsと同じ）
const PhilosophySchema = z.object({
  version: z.string(),
  creed: z.string(),
  age_in_days: z.number().default(0), // 哲学の年齢（日数）
  stance: z.object({
    economic_left_right: z.number().min(-1).max(1),
    social_liberal_conservative: z.number().min(-1).max(1),
  }),
  bias: z.object({
    confirmation: z.number().min(0).max(1),
    recency: z.number().min(0).max(1),
    change_resistance: z.number().min(0).max(1),
  }),
  hooks: z.object({
    triggers: z.array(z.string()),
    taboos: z.array(z.string()),
  }),
});

export type Philosophy = z.infer<typeof PhilosophySchema>;

export class PhilosophyManager {
  private dataDir = "./data";
  private characterName: string;
  private characterDir: string;
  private archiveDir: string;

  constructor(characterName: string = "default") {
    this.characterName = characterName;
    this.characterDir = path.join(this.dataDir, characterName);
    this.archiveDir = path.join(this.characterDir, "archive");

    // キャラクターディレクトリとアーカイブディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.characterDir)) {
      fs.mkdirSync(this.characterDir, { recursive: true });
    }
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }

  // 現在のphilosophy.jsonのパスを取得
  getPhilosophyPath(): string {
    return path.join(this.characterDir, "philosophy.json");
  }

  // デフォルトの哲学データを作成
  createDefaultPhilosophy(): Philosophy {
    return {
      version: "1.0",
      creed: "まだ何も学習していない",
      age_in_days: 0,
      stance: {
        economic_left_right: 0,
        social_liberal_conservative: 0,
      },
      bias: {
        confirmation: 0.3,
        recency: 0.3,
        change_resistance: 0.3,
      },
      hooks: {
        triggers: ["革新", "変化", "成長"],
        taboos: ["停滞", "固執"],
      },
    };
  }

  // 哲学データを読み込む
  loadPhilosophy(): Philosophy {
    const philosophyPath = this.getPhilosophyPath();

    if (!fs.existsSync(philosophyPath)) {
      // ファイルが存在しない場合はデフォルトを作成
      const defaultPhilosophy = this.createDefaultPhilosophy();
      fs.writeFileSync(
        philosophyPath,
        JSON.stringify(defaultPhilosophy, null, 2)
      );
      return defaultPhilosophy;
    }

    const data = fs.readFileSync(philosophyPath, "utf-8");
    return JSON.parse(data);
  }

  // 3世代をローテーション
  rotateGenerations(newPhilosophy: Philosophy): void {
    console.log(`--${this.characterName}の哲学データの世代管理を実行します--`);

    // backup → archive
    const backupPath = path.join(this.characterDir, "philosophy_backup.json");
    if (fs.existsSync(backupPath)) {
      const backup = fs.readFileSync(backupPath, "utf-8");
      const now = new Date();
      const timestamp = `${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}_${now.getHours()}_${now.getMinutes()}`;
      const archivePath = path.join(
        this.archiveDir,
        `philosophy_${timestamp}.json`
      );
      fs.writeFileSync(archivePath, backup);
      console.log(`バックアップをアーカイブに移動: ${archivePath}`);
    }

    // previous → backup
    const previousPath = path.join(
      this.characterDir,
      "philosophy_previous.json"
    );
    if (fs.existsSync(previousPath)) {
      fs.copyFileSync(previousPath, backupPath);
      console.log("前世代をバックアップに移動");
    }

    // current → previous
    const currentPath = this.getPhilosophyPath();
    if (fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, previousPath);
      console.log("現世代を前世代に移動");
    }

    // new → current
    fs.writeFileSync(currentPath, JSON.stringify(newPhilosophy, null, 2));
    console.log("新しい哲学データを現世代として保存");
  }

  // ロールバック機能
  rollback(generations: number = 1): boolean {
    const currentPath = this.getPhilosophyPath();
    const previousPath = path.join(
      this.characterDir,
      "philosophy_previous.json"
    );
    const backupPath = path.join(this.characterDir, "philosophy_backup.json");

    if (generations === 1 && fs.existsSync(previousPath)) {
      fs.copyFileSync(previousPath, currentPath);
      console.log("1世代前の哲学データにロールバックしました");
      return true;
    } else if (generations === 2 && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, currentPath);
      console.log("2世代前の哲学データにロールバックしました");
      return true;
    }

    console.log(`${generations}世代前のデータが存在しません`);
    return false;
  }

  // 簡単な差分表示
  showDiff(): void {
    const currentPath = this.getPhilosophyPath();
    const previousPath = path.join(
      this.characterDir,
      "philosophy_previous.json"
    );

    if (!fs.existsSync(previousPath)) {
      console.log("前世代のデータが存在しないため、差分を表示できません");
      return;
    }

    try {
      const current = JSON.parse(fs.readFileSync(currentPath, "utf-8"));
      const previous = JSON.parse(fs.readFileSync(previousPath, "utf-8"));

      console.log(`\n=== ${this.characterName}の哲学の変化 ===`);

      // スタンスの変化
      const economicDelta =
        current.stance.economic_left_right -
        previous.stance.economic_left_right;
      const socialDelta =
        current.stance.social_liberal_conservative -
        previous.stance.social_liberal_conservative;

      console.log(
        `経済観: ${previous.stance.economic_left_right.toFixed(3)} → ${current.stance.economic_left_right.toFixed(3)} (${economicDelta >= 0 ? "+" : ""}${economicDelta.toFixed(3)})`
      );
      console.log(
        `社会観: ${previous.stance.social_liberal_conservative.toFixed(3)} → ${current.stance.social_liberal_conservative.toFixed(3)} (${socialDelta >= 0 ? "+" : ""}${socialDelta.toFixed(3)})`
      );

      // バイアスの変化
      if (JSON.stringify(current.bias) !== JSON.stringify(previous.bias)) {
        console.log("\nバイアスの変化:");
        console.log(
          `  確証バイアス: ${previous.bias.confirmation} → ${current.bias.confirmation}`
        );
        console.log(
          `  新近性バイアス: ${previous.bias.recency} → ${current.bias.recency}`
        );
        console.log(
          `  変化抵抗: ${previous.bias.change_resistance} → ${current.bias.change_resistance}`
        );
      }

      // 信念の変化
      if (current.creed !== previous.creed) {
        console.log("\n信念が更新されました:");
        console.log("【前】", previous.creed.substring(0, 50) + "...");
        console.log("【後】", current.creed.substring(0, 50) + "...");
      }

      // フックの変化
      const triggersDiff = current.hooks.triggers.filter(
        (t: string) => !previous.hooks.triggers.includes(t)
      );
      const taboosDiff = current.hooks.taboos.filter(
        (t: string) => !previous.hooks.taboos.includes(t)
      );

      if (triggersDiff.length > 0) {
        console.log("\n新しいトリガー:", triggersDiff.join(", "));
      }
      if (taboosDiff.length > 0) {
        console.log("新しいタブー:", taboosDiff.join(", "));
      }

      console.log("==================\n");
    } catch (error) {
      console.error("差分表示中にエラーが発生しました:", error);
    }
  }

  // アーカイブのクリーンアップ（古いファイルを削除）
  cleanupArchive(daysToKeep: number = 30): void {
    const now = Date.now();
    const cutoffTime = daysToKeep * 24 * 60 * 60 * 1000;

    const files = fs.readdirSync(this.archiveDir);
    let deletedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(this.archiveDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      console.log(`${deletedCount}個の古いアーカイブファイルを削除しました`);
    }
  }

  // 現在の世代状況を表示
  showGenerationStatus(): void {
    console.log(`\n=== ${this.characterName}の哲学データの世代状況 ===`);

    const files = [
      { name: "現世代", path: "philosophy.json" },
      { name: "前世代", path: "philosophy_previous.json" },
      { name: "バックアップ", path: "philosophy_backup.json" },
    ];

    files.forEach((file) => {
      const filePath = path.join(this.characterDir, file.path);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const modTime = stats.mtime.toLocaleString("ja-JP");
        console.log(`${file.name}: ${modTime}`);
      } else {
        console.log(`${file.name}: 存在しません`);
      }
    });

    // アーカイブの数を表示
    const archiveFiles = fs.readdirSync(this.archiveDir);
    console.log(`アーカイブ: ${archiveFiles.length}個のファイル`);
    console.log("========================\n");
  }

  // 利用可能なキャラクターのリストを取得（静的メソッド）
  static getAvailableCharacters(): string[] {
    const dataDir = "./data";

    if (!fs.existsSync(dataDir)) {
      return [];
    }

    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    const characters = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== "archive"); // グローバルアーカイブディレクトリを除外

    return characters;
  }

  // 既存のdata直下のphilosophy.jsonをdefaultキャラクターに移行（静的メソッド）
  static migrateExistingPhilosophy(): void {
    const oldPhilosophyPath = path.join("./data", "philosophy.json");
    const oldPreviousPath = path.join("./data", "philosophy_previous.json");
    const oldBackupPath = path.join("./data", "philosophy_backup.json");

    if (fs.existsSync(oldPhilosophyPath)) {
      console.log("既存のphilosophy.jsonをdefaultキャラクターに移行します...");

      const defaultManager = new PhilosophyManager("default");

      // 各ファイルを移動
      if (fs.existsSync(oldPhilosophyPath)) {
        fs.renameSync(oldPhilosophyPath, defaultManager.getPhilosophyPath());
      }

      if (fs.existsSync(oldPreviousPath)) {
        fs.renameSync(
          oldPreviousPath,
          path.join(defaultManager.characterDir, "philosophy_previous.json")
        );
      }

      if (fs.existsSync(oldBackupPath)) {
        fs.renameSync(
          oldBackupPath,
          path.join(defaultManager.characterDir, "philosophy_backup.json")
        );
      }

      console.log("移行が完了しました。");
    }
  }

  // キャラクターを削除（静的メソッド）
  static deleteCharacter(characterName: string): boolean {
    if (characterName === "default") {
      console.log("defaultキャラクターは削除できません");
      return false;
    }

    const characterDir = path.join("./data", characterName);

    if (!fs.existsSync(characterDir)) {
      console.log(`キャラクター「${characterName}」が存在しません`);
      return false;
    }

    try {
      // ディレクトリを再帰的に削除
      fs.rmSync(characterDir, { recursive: true, force: true });
      console.log(`キャラクター「${characterName}」を削除しました`);
      return true;
    } catch (error) {
      console.error(`キャラクター削除中にエラーが発生しました:`, error);
      return false;
    }
  }
}
