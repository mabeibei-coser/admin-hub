// SHARED: 同时存在于 career-report/lib/projects.ts —— 改一边记得改另一边。
// 没有走 _shared/ 是为了让每个 repo 自己拥有自己的代码（owner: admin-hub + career-report 双拥有）。

/**
 * 项目元数据中心。
 * admin UI 渲染处必须用这里的 label，不准写 'report'/'nav' 这种 code identifier。
 *
 * 添加新项目（如徐汇/浦东）：在 PROJECTS 里加一项 + admin API 加 schema 即可。
 */

export type ProjectId = "report" | "nav" | "startup" | "tailor" | "salary" | "hazard";

export interface ProjectMeta {
  id: ProjectId;
  /** UI 长标签（Tab 标题、详情面包屑） */
  label: string;
  /** UI 短标签（Badge、列表标记） */
  shortLabel: string;
  /** Badge 主色（Tailwind 兼容） */
  color: "blue" | "green" | "purple" | "orange" | "cyan" | "amber";
  /** 报告章节数（详情页用来标题里显示，可选） */
  sectionCount: number;
  /** 业务描述（sidebar / 标题副文案） */
  description?: string;
}

export const PROJECTS: Record<ProjectId, ProjectMeta> = {
  report: {
    id: "report",
    label: "职业定位",
    shortLabel: "职业定位",
    color: "blue",
    sectionCount: 6,
    description: "应届校招求职报告",
  },
  nav: {
    id: "nav",
    label: "职业导航",
    shortLabel: "导航",
    color: "green",
    sectionCount: 5,
    description: "求职指导评估报告",
  },
  startup: {
    id: "startup",
    label: "创业诊断",
    shortLabel: "创业",
    color: "purple",
    sectionCount: 3,
    description: "创业项目六维诊断报告",
  },
  tailor: {
    id: "tailor",
    label: "简历定制",
    shortLabel: "简历",
    color: "orange",
    sectionCount: 2,
    description: "岗位定向简历修改报告",
  },
  salary: {
    id: "salary",
    label: "薪酬查询",
    shortLabel: "薪酬",
    color: "cyan",
    sectionCount: 5,
    description: "岗位薪酬查询报告",
  },
  hazard: {
    id: "hazard",
    label: "隐患识别",
    shortLabel: "隐患",
    color: "amber",
    sectionCount: 1,
    description: "安全隐患图像识别报告",
  },
};

export const PROJECT_LIST: ProjectMeta[] = Object.values(PROJECTS);

/** 给 ProjectSwitcher 用的选项类型（含可选的 "全部" 入口） */
export interface ProjectOption {
  id: ProjectId | "all";
  label: string;
}

/** 完整选项列表：全部 + 各项目 */
export const PROJECT_OPTIONS: ProjectOption[] = [
  { id: "all", label: "全部" },
  ...PROJECT_LIST.map((p) => ({ id: p.id, label: p.label })),
];
