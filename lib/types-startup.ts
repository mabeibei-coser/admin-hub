/**
 * ⚠️ 自动生成文件，不要手改。
 * 来源：startup-dig/contracts/startup-dig.ts
 * 同步命令：npm run sync-contracts startup
 *
 * 想改这份 types，先去 startup-dig 项目改 contracts/startup-dig.ts，
 * 再来 admin-hub 跑 sync，然后 commit + 部署。两边任何一边单独改都不算数。
 * 上次同步：2026-05-26T14:30:15.102Z
 */

// ========== 表单输入类型 ==========

export type UserIdentity = "founder";

export interface JobFormData {
  /** 项目名称 */
  projectName: string;
  /** 启动资金范围 */
  startupCapital: string;
  /** 主要产品/服务 */
  productOrService: string;
  /** 创业经验：none=无经验 / one=有一次 / multiple=有多次 */
  startupExperience: "none" | "one" | "multiple";
  /** 从简历正文启发式抽取的姓名（admin 后台展示用） */
  name?: string;
  /** 从简历正文启发式抽取的中国大陆手机号（admin 后台展示用） */
  phone?: string;
  resumeText?: string;
  resumeFileName?: string;
  /** @deprecated Legacy career-nav compatibility for unused modules/tests. */
  identity?: "recent_grad" | "young_unemployed" | "general_unemployed";
  /** @deprecated Legacy career-nav compatibility for unused modules/tests. */
  education?: string;
  /** @deprecated Legacy career-nav compatibility for unused modules/tests. */
  workYears?: string;
  /** @deprecated Legacy career-nav compatibility for unused modules/tests. */
  targetPosition?: string;
}

// ========== 量表测评类型 ==========

export type StartupDimension =
  | "demand_positioning"
  | "product_business"
  | "market_competitiveness"
  | "team_capability"
  | "development_status"
  | "planning_risk";

export const STARTUP_DIMENSION_NAMES: Record<StartupDimension, string> = {
  demand_positioning: "需求与定位",
  product_business: "产品与商业模式",
  market_competitiveness: "市场与竞争力",
  team_capability: "团队能力",
  development_status: "项目发展现状",
  planning_risk: "发展规划与风险",
};

export type QuizDimension = StartupDimension;

export const QUIZ_DIMENSION_NAMES: Record<QuizDimension, string> = STARTUP_DIMENSION_NAMES;

export type AbilityKey =
  | "demand_analysis"
  | "product_design"
  | "market_strategy"
  | "team_management"
  | "execution_status"
  | "risk_planning";

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  demand_analysis: "需求分析",
  product_design: "产品设计",
  market_strategy: "市场策略",
  team_management: "团队管理",
  execution_status: "执行现状",
  risk_planning: "风险规划",
};

export interface QuizOption {
  label: "A" | "B" | "C" | "D";
  text: string;
  poleValue?: number;
  weights: Partial<Record<AbilityKey, number>>;
}

export interface QuizQuestion {
  id: string;
  dimension?: QuizDimension;
  text: string;
  options: QuizOption[];
}

export interface QuizBank {
  version: string;
  fixedQuestions: QuizQuestion[];
}

export interface QuizAnswer {
  questionId: string;
  selectedLabel: "A" | "B" | "C" | "D";
}

export interface DimensionScore {
  dimension: StartupDimension;
  name: string;
  score: number;
}

export interface AbilityScore {
  key: AbilityKey;
  name: string;
  score: number;
}

export interface ScoringResult {
  sixDim: DimensionScore[];
  ability: AbilityScore[];
}

// ========== 访谈类型 ==========

export type InterviewQuestionId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6";

export interface InterviewQuestion {
  id: InterviewQuestionId;
  text: string;
  source: "dynamic" | "fixed";
  audioBase64?: string;
}

export interface InterviewAnswer {
  questionId: InterviewQuestionId;
  text: string;
  inputMethod: "voice" | "text";
  audioDurationSec?: number;
}

export interface InterviewQ1Q6 {
  Q1?: string;
  Q2?: string;
  Q3?: string;
  Q4?: string;
  Q5?: string;
  Q6?: string;
}

export type InterviewQ1Q2 = InterviewQ1Q6;

// ========== 报告类型 ==========

export type ReportSectionKey = "overview" | "dimensionDetails" | "riskAssessment";

export interface ReportMeta {
  generatedAt: string;
  formData: JobFormData;
  scoring: ScoringResult;
  hasResume: boolean;
  interviewQ1Q2: InterviewQ1Q2;
}

export interface Overview {
  summary: string;
  sixDimRadar: {
    name: string;
    score: number;
    conclusion?: string;
  }[];
  personality: {
    type: string;
    traits: string[];
    description: string;
  };
}

export interface DimensionDetail {
  dimension: StartupDimension;
  name: string;
  assessment: string;
  suggestion: string;
}

export interface DimensionDetails {
  dimensions: DimensionDetail[];
}

export interface RiskItem {
  riskType: string;
  description: string;
  strategy: string;
}

export interface RiskAssessment {
  risks: RiskItem[];
}

export interface ReportData {
  meta: ReportMeta;
  overview: Overview;
  dimensionDetails: DimensionDetails;
  riskAssessment?: RiskAssessment;
}

export interface SectionProgress {
  key: ReportSectionKey;
  status: "pending" | "running" | "done" | "error" | "fallback";
  attempt: number;
  errorMessage?: string;
}
