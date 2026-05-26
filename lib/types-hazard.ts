// hazard-detect 项目的类型定义
// SHARED: 与 hazard-detect 项目结构对应；hazard-detect 是 JSX 项目无 ts 类型，
// 这里的类型是基于 server.js/api/analyze 实际返回结构 + lib/db.js reports schema 写的。
// owner: admin-hub 独有（hazard-detect 无 .ts）

/** 单条隐患 */
export interface HazardItem {
  /** 隐患名称（15 字以内） */
  hazard_name: string;
  /** 隐患等级：高 / 中 / 低 */
  hazard_level: "高" | "中" | "低";
  /** 隐患描述（100-200 字） */
  hazard_description: string;
  /** 涉及国家标准 / 行业规范（如 "GB 50016-2014 第 X.X.X 条"） */
  relevant_regulations: string;
  /** 整改建议（多行，"1. ... 2. ... 3. ..."） */
  rectification_suggestions: string;
  /** 预算经费（如 "¥1,000 - 2,000 元"） */
  estimated_budget: string;
}

/** report_json 列存的内容：直接是 hazards 数组 */
export type HazardReportData = HazardItem[];

/** hazard.reports 表的行结构（admin 查询用） */
export interface HazardReportRow {
  id: number;
  user_id: number;
  user_phone: string;
  created_at: number;
  /** 场景 id，如 general / hospital / kitchen */
  scenario: string;
  /** 场景中文名（denorm） */
  scenario_label: string | null;
  /** 本次识别出几条隐患 */
  hazard_count: number;
  /** hazards 数组的 JSON 文本 */
  report_json: string;
  duration_ms: number | null;
  ip: string | null;
  user_agent: string | null;
}
