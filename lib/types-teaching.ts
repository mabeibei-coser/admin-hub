// 智能课件（smart-teaching）报告类型。
// 物理复制自 smart-teaching 项目（跨 repo 无法 import）。owner: admin-hub + smart-teaching 双拥有。
//
// smart-teaching 的 reports 表一张表存两种 type：
//   - "courseware"  课件创作：report_json = CoursewareReport（一张生成图）
//   - "interaction" 课堂互动：report_json = InteractionReport（案例/辩论/角色扮演... 三段式）

export type TeachingType = "courseware" | "interaction";

/** 课件创作：服务端生成的一张图 + 元信息 */
export interface CoursewareReport {
  imageDataUrl: string;
  revisedPrompt?: string;
  cardType?: string;
  cardStyle?: string;
  cardSize?: string;
  line?: string;
}

/**
 * 课堂互动方案：三段式。
 * 各段的子字段随互动类型（案例分析 / 正反辩论 / 角色扮演 / 项目探究 / 问题解决）变化，
 * 所以这里用宽松的 Record 容纳，渲染层做泛型展开（数组→列表，字符串→段落）。
 */
export interface InteractionReport {
  caseContent?: Record<string, unknown>;
  referenceAnswer?: Record<string, unknown>;
  keyPoints?: Record<string, unknown>;
  /** 课堂互动方案的页面截图（用户端 html2canvas 上传），后台详情可预览 */
  screenshotImage?: string;
}

export type TeachingReport = CoursewareReport | InteractionReport;

/**
 * 服务子项中文标签（列表"服务子项"列 + 详情共用）。
 * type 列的两种取值 → 用户侧两个功能入口的名字。
 * 注意：项目名"智能课件"来自 PROJECTS.teaching.label，与此 map 无关。
 */
export const TEACHING_TYPE_LABELS: Record<string, string> = {
  courseware: "课件创作",
  interaction: "课堂互动",
};

export const TEACHING_LINE_LABELS: Record<string, string> = {
  line1: "GPT",
  line2: "讯飞星火",
  line3: "豆包",
};
