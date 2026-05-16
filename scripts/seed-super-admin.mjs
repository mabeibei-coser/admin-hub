/**
 * 首次部署专用：交互式建立第一个超管账号。
 * 用法：node scripts/seed-super-admin.mjs
 *
 * 将直接写入 data/career-report.db（或 DB_PATH 环境变量指向的路径）。
 * bcrypt cost=10（M1：防 DoS 放大，小后台足够安全）。
 */

import bcrypt from "bcryptjs";
import readline from "readline";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const DATA_DIR = path.join(projectRoot, "data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "career-report.db");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function isValidCnMobile(s) {
  return /^1[3-9]\d{9}$/.test(s);
}

async function main() {
  console.log("=== 超管初始化 ===\n");

  // --- 手机号 ---
  let username;
  while (true) {
    username = (await question("登录手机号（11 位大陆手机）: ")).trim();
    if (!isValidCnMobile(username)) {
      console.log("格式不对，请输入 11 位大陆手机号。\n");
      continue;
    }
    break;
  }

  // --- 姓名 ---
  let name;
  while (true) {
    name = (await question("姓名（如：张三）: ")).trim();
    if (!name) {
      console.log("姓名不能为空。\n");
      continue;
    }
    break;
  }

  // --- 密码 ---
  let password;
  while (true) {
    password = await question("密码（至少 8 位）: ");
    if (password.length < 8) {
      console.log("密码至少 8 位，请重试。\n");
      continue;
    }
    const confirm = await question("再输一次确认: ");
    if (password !== confirm) {
      console.log("两次输入不一致，请重试。\n");
      continue;
    }
    break;
  }

  console.log("\n正在生成 bcrypt hash（cost=10，约需 1 秒）...");
  const passwordHash = await bcrypt.hash(password, 10);

  // --- 写入 DB ---
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // 确保 admins 表存在（首次运行时 db 可能还没有被 Next.js 初始化）
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      username              TEXT NOT NULL UNIQUE,
      name                  TEXT NOT NULL,
      password_hash         TEXT NOT NULL,
      note                  TEXT,
      menus_json            TEXT NOT NULL DEFAULT '[]',
      is_super              INTEGER NOT NULL DEFAULT 0,
      is_active             INTEGER NOT NULL DEFAULT 1,
      session_invalid_after INTEGER,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
  `);

  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO admins (username, name, password_hash, menus_json, is_super, is_active, created_at, updated_at)
       VALUES (?, ?, ?, '[]', 1, 1, ?, ?)`
    ).run(username, name, passwordHash, now, now);
  } catch (e) {
    if (e.message?.includes("UNIQUE constraint failed")) {
      console.error(`\n错误：手机号 ${username} 已存在。请直接在后台编辑该账号，或手动修改 DB。`);
      rl.close();
      process.exit(1);
    }
    throw e;
  }

  db.close();
  console.log(`\n✅ 超管 "${name}"（${username}）已创建，is_super=1。`);
  console.log("现在可以用该手机号 + 密码登录后台。\n");
  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
