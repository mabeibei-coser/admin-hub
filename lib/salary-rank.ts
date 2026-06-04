// SHARED: 来源 salary-report/src/data/salaryDatabase.js 的 rankMultiplier。
// 改这里之前先去那边改。两边不一致时前台为准。
//
// 用途：admin-hub 渲染薪酬报告列表时，把数据库里的 rank 代码（"P2"）映射成
// 与用户端选项 1:1 一致的标签（"P2(初级专员/技术员)"），避免后台显示只剩
// 半截"初级专员"对不上前台。

export const SALARY_RANK_LABELS: Record<string, string> = {
  // 技术序列 P1-P9
  P1: "P1(文员/助理)",
  P2: "P2(初级专员/技术员)",
  P3: "P3(中级)",
  P4: "P4(高级专员/技术员)",
  P5: "P5(资深/工程师)",
  P6: "P6(专家/独立负责)",
  P7: "P7(高级专家/模块负责人)",
  P8: "P8(资深专家/领域负责人)",
  P9: "P9(首席/行业权威)",
  // 管理序列 M1-M5
  M1: "M1(团队主管)",
  M2: "M2(经理)",
  M3: "M3(高级经理)",
  M4: "M4(总监)",
  M5: "M5(副总裁)",
};

/** 优先用本地字典 → DB rank_label → 裸 rank 代码 → fallback */
export function formatSalaryRank(
  rank: string | null | undefined,
  rankLabel: string | null | undefined,
  fallback = "—",
): string {
  if (rank && SALARY_RANK_LABELS[rank]) return SALARY_RANK_LABELS[rank];
  if (rankLabel) return rankLabel;
  if (rank) return rank;
  return fallback;
}
