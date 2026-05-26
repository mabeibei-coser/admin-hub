/**
 * ⚠️ 自动生成文件，不要手改。
 * 来源：salary-report/contracts/salary-report.ts
 * 同步命令：npm run sync-salary
 *
 * 想改这份 types，先去 salary-report 项目改 contracts/salary-report.ts，
 * 再来 admin-hub 跑 sync，然后 commit + 部署。两边任何一边单独改都不算数。
 * 上次同步：2026-05-26T14:22:40.120Z
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

/** salary-report 数据库 reports 表的直接列（非 report_json 内字段） */
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
