/**
 * 薪酬数字 / 比对文案格式化工具。
 * 翻译自 salary-report 项目 src/utils/salaryCalculator.js（保留同样语义）。
 */

/** 大于等于 1 万走"万"单位，否则千分位整数。 */
export function formatSalary(amount: number, showWan = true): string {
  if (amount >= 10000 && showWan) {
    const wan = (amount / 10000).toFixed(1).replace(/\.0$/, "");
    return `${wan}万`;
  }
  return amount.toLocaleString("zh-CN");
}

/** 带千分位的整数字符串。 */
export function formatNumber(amount: number): string {
  return amount.toLocaleString("zh-CN");
}

export interface ComparisonStyle {
  text: string;
  tone: "positive" | "neutral" | "warning" | "danger";
}

/** 月薪 vs 市场均值差异 → 文字 + 语义色调（admin-hub 用 status-pill tone 体系）。 */
export function getComparisonStyle(diffPct: number): ComparisonStyle {
  if (diffPct > 20) return { text: "显著高于市场平均水平", tone: "positive" };
  if (diffPct > 5) return { text: "高于市场平均水平", tone: "positive" };
  if (diffPct > -5) return { text: "与市场平均水平持平", tone: "neutral" };
  if (diffPct > -20) return { text: "低于市场平均水平", tone: "warning" };
  return { text: "显著低于市场平均水平", tone: "danger" };
}

/** 一句话市场定位总结（与 salary-report 渲染逻辑一致）。 */
export function generateMarketSummary(
  position: string,
  company: string,
  diffPct: number,
  monthly: number,
): string {
  const direction = diffPct >= 0 ? "高于" : "低于";
  const absPct = Math.abs(diffPct);
  const level = monthly >= 30000 ? "高薪区间" : monthly >= 15000 ? "中等偏上" : "成长区间";
  if (diffPct > 15) {
    return `${company}的${position}岗位薪酬处于市场${level}，月薪${direction}市场均值约${absPct}%，具有较强竞争力。`;
  }
  if (diffPct > 0) {
    return `${company}的${position}岗位薪酬处于市场${level}，月薪略${direction}市场均值约${absPct}%，整体与市场保持同步。`;
  }
  if (diffPct > -15) {
    return `${company}的${position}岗位薪酬处于市场${level}，月薪略${direction}市场均值约${absPct}%，建议关注综合福利与成长空间。`;
  }
  return `${company}的${position}岗位薪酬处于市场${level}，月薪${direction}市场均值约${absPct}%，但综合福利与发展前景可能弥补薪资差距。`;
}

/** 高级职级判定：P6+ 或 M3+ 才显示股权卡。 */
export function isSeniorRank(rank: string | undefined | null): boolean {
  if (!rank) return false;
  const num = parseInt(rank.replace(/[^0-9]/g, ""), 10) || 0;
  if (rank.startsWith("P")) return num >= 6;
  if (rank.startsWith("M")) return num >= 3;
  return false;
}
