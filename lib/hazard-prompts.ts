/**
 * 读写 hazard-detect 项目的 prompts.json。
 * env HAZARD_PROMPTS_PATH 指向 hazard-detect/data/prompts.json 绝对路径。
 *
 * 写策略：
 *   - 先 schema 校验（labels + prompts 必须完整）
 *   - 复制旧文件到 .bak.<ts>（保留最近 5 个备份，更老的自动清掉）
 *   - 写 .tmp 文件 + rename，避免读到半截
 */

import fs from "node:fs";
import path from "node:path";

export interface ScenarioPrompt {
  name: string;
  context: string;
  focus: string[];
}

export interface PromptsFile {
  $schema?: string;
  generated_at?: string;
  labels: Record<string, string>;
  prompts: Record<string, ScenarioPrompt>;
}

const MAX_BACKUPS = 5;

function getPath(): string {
  const p = process.env.HAZARD_PROMPTS_PATH;
  if (!p) {
    throw new Error(
      "HAZARD_PROMPTS_PATH 未设置 —— 指向 hazard-detect/data/prompts.json 的绝对路径",
    );
  }
  return p;
}

export function readPrompts(): PromptsFile {
  const raw = fs.readFileSync(getPath(), "utf8");
  const data = JSON.parse(raw) as PromptsFile;
  if (
    !data ||
    typeof data.labels !== "object" ||
    typeof data.prompts !== "object"
  ) {
    throw new Error("prompts.json 结构非法：缺少 labels 或 prompts");
  }
  return data;
}

/** 校验单个场景的结构。返回 null = OK，否则返回错误描述。 */
export function validateScenario(s: unknown): string | null {
  if (!s || typeof s !== "object") return "必须是对象";
  const o = s as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) return "name 必填";
  if (typeof o.context !== "string") return "context 必须是字符串";
  if (!Array.isArray(o.focus)) return "focus 必须是数组";
  if (!o.focus.every((f) => typeof f === "string"))
    return "focus 每一项必须是字符串";
  return null;
}

/**
 * 写入单个场景。返回写入后的新文件内容。
 *
 * 注意：本函数同时更新 labels[scenarioId] = scenario.name，保持两者同步。
 */
export function writeScenario(
  scenarioId: string,
  scenario: ScenarioPrompt,
): PromptsFile {
  const filePath = getPath();
  const current = readPrompts();

  if (!(scenarioId in current.prompts)) {
    throw new Error(`场景 id 不存在：${scenarioId}`);
  }

  // 备份旧文件（同步，文件小、低频）
  rotateBackup(filePath);

  // 应用新数据
  current.prompts[scenarioId] = {
    name: scenario.name.trim(),
    context: scenario.context,
    focus: scenario.focus.map((f) => String(f)),
  };
  current.labels[scenarioId] = scenario.name.trim();
  current.generated_at = new Date().toISOString();

  // 原子写：写 tmp → rename
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(current, null, 2), "utf8");
  fs.renameSync(tmp, filePath);

  return current;
}

function rotateBackup(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = path.join(dir, `${base}.bak.${ts}`);
  fs.copyFileSync(filePath, bak);

  // 清理：只保留最近 MAX_BACKUPS 个 .bak.* 文件
  const allBaks = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.bak.`))
    .map((f) => ({ f, full: path.join(dir, f) }))
    .sort((a, b) => fs.statSync(a.full).mtimeMs - fs.statSync(b.full).mtimeMs);
  while (allBaks.length > MAX_BACKUPS) {
    const { full } = allBaks.shift()!;
    try {
      fs.unlinkSync(full);
    } catch {
      // 安静失败：备份清理不应阻塞主流程
    }
  }
}
