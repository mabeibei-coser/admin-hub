/**
 * 薪酬查询报告数据契约。
 * 来源：salary-report 项目 server.js 里 validateAndNormalize 之后的 JSON。
 * 这里手抄一份是因为 admin-hub 跟 salary-report 跨 repo 无法 import。
 */

export type RankCategory = "tech" | "mgmt";

export interface Percentile {
  p25: number;
  p50: number;
  p75: number;
}

export interface MarketComparison {
  marketAvgMonthly: number;
  diffPct: number;
}

export interface SalaryTrendPoint {
  year: number;
  monthly: number;
}

export interface IndustryAnalysisItem {
  industry: string;
  description: string;
  monthlyRange: string;
  annualRange: string;
  demandLevel: string;
  salaryIncrease: string;
}

export interface CityAnalysisItem {
  city: string;
  monthlyAvg: number;
  costIndex: number;
  salaryLevel: string;
  advantage: string;
}

export interface SalaryReportData {
  position: string;
  company: string;
  rank: string;
  rankLabel: string;
  rankCategory: RankCategory;
  education: string;
  city: string;
  monthly: Percentile;
  annual: Percentile;
  bonusMonths: Percentile;
  equity: Percentile;
  housingFund: Percentile;
  hourlyRate: Percentile;
  marketComparison: MarketComparison;
  salaryTrend: SalaryTrendPoint[];
  industryAnalysis: IndustryAnalysisItem[];
  cityAnalysis: CityAnalysisItem[];
  highEarnerTraits: string;
}

/** salary.reports 表里直接列（admin-hub 详情 API meta 字段） */
export interface SalaryReportMeta {
  id: number;
  user_id: number;
  user_phone: string;
  created_at: number;
  position: string;
  company: string;
  rank: string;
  rank_label: string | null;
  education: string;
  city: string;
  duration_ms: number | null;
  ip: string | null;
  user_agent: string | null;
}
