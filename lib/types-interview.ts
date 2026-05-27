/**
 * ⚠️ 手动复制自动同步：暂无 sync 脚本，改一边记得改另一边。
 * 来源：D:\_workspace\01_项目-Coding\ai-interview2\lib\types.ts
 *      D:\_workspace\01_项目-Coding\ai-interview2\lib\form-options.ts
 * 上次同步：2026-05-27
 *
 * admin-hub 只用作展示（reports 列表 + 详情 + 报告渲染）。
 * 业务字段以面试场景为主，保留部分创业诊断旧字段（向后兼容）。
 */

// ========== 表单输入类型（AI 面试） ==========

export type UserIdentity = "founder";

export interface JobFormData {
  /** 面试岗位 */
  position: string;
  /** 企业性质 */
  companyType: string;
  /** 岗位职级 */
  jobLevel: string;
  /** 面试语言 */
  interviewLanguage?: "zh" | "en" | "mixed";
  /** 从简历正文启发式抽取的姓名（admin 后台展示用） */
  name?: string;
  /** 从简历正文启发式抽取的中国大陆手机号（admin 后台展示用） */
  phone?: string;
  resumeText?: string;
  resumeFileName?: string;
  /** 保留字段（向后兼容） */
  projectName?: string;
  startupCapital?: string;
  productOrService?: string;
  isFirstStartup?: "yes" | "no";
}

// ========== 表单选项常量（与 ai-interview2/lib/form-options.ts 对齐） ==========

export const COMPANY_TYPE_OPTIONS = [
  { value: "startup", label: "初创企业" },
  { value: "private", label: "民营企业" },
  { value: "joint-venture", label: "合资企业" },
  { value: "foreign", label: "外资企业" },
  { value: "public-institution", label: "事业单位" },
] as const;

export const JOB_LEVEL_OPTIONS = [
  { value: "junior", label: "初级（0-3 年经验）" },
  { value: "intermediate", label: "中级（3-5 年经验）" },
  { value: "senior", label: "高级（5 年以上经验）" },
] as const;

export const INTERVIEW_LANGUAGE_OPTIONS = [
  { value: "zh", label: "全普通话" },
  { value: "en", label: "全英语" },
  { value: "mixed", label: "部分英语（8 轮中 2 轮）" },
] as const;

/** value → label 映射（admin 列表/详情用） */
export const COMPANY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  COMPANY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);
export const JOB_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  JOB_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);
export const INTERVIEW_LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  INTERVIEW_LANGUAGE_OPTIONS.map((o) => [o.value, o.label]),
);

// ========== 量表测评类型 ==========

// 6 个创业要素维度（旧量表保留兼容）
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
  score: number; // 1-5 分
}

export interface AbilityScore {
  key: AbilityKey;
  name: string;
  score: number; // 1-5 分
}

/** 职场五力维度 key（inline，避免依赖 ai-interview2 的 workplace-five-forces.ts） */
export type WorkplaceDimensionKey = string;

export interface ScoringResult {
  /** 旧：6 个创业要素维度（已废弃，保留以兼容旧代码） */
  sixDim?: DimensionScore[];
  /** 新：职场五力模型 5 个维度 */
  dimensions?: DimensionScore[];
  ability?: AbilityScore[];
  overallSummary?: string;
  topDimension?: WorkplaceDimensionKey;
  lowestDimension?: WorkplaceDimensionKey;
}

// ========== 访谈类型 ==========

export type InterviewQuestionId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8";

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
  Q7?: string;
  Q8?: string;
}

// 向后兼容（startup 旧名）
export type InterviewQ1Q2 = InterviewQ1Q6;

// ========== 报告类型（创业旧版，保留向后兼容） ==========

export type ReportSectionKey = "overview" | "dimensionDetails";

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
  strengths: string;
  improvements: string;
}

export interface DimensionDetails {
  dimensions: DimensionDetail[];
}

export interface ReportData {
  meta: ReportMeta;
  overview: Overview;
  dimensionDetails: DimensionDetails;
}

export interface SectionProgress {
  key: ReportSectionKey;
  status: "pending" | "running" | "done" | "error" | "fallback";
  attempt: number;
  errorMessage?: string;
}

// ========== 面试报告类型（C 线：报告生成系统，主用） ==========

export interface InterviewScore {
  totalScore: number;
  deductions: DeductionItem[];
  overallEvaluation?: string;
  abilityScores?: AbilityScoreDetail[];
}

export interface DeductionItem {
  reason: string;
  deductedPoints: number;
  evidence?: string;
}

export interface AbilityScoreDetail {
  key: string;
  name: string;
  score: number;
  rubric?: AbilityRubric;
  evidence: string;
}

export interface AbilityRubric {
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
}

export interface JobMatchingRadar {
  dimensions: {
    dimension: string;
    name: string;
    score: number; // 0-10 分
    excellentPerformance?: string;
  }[];
  suggestions?: string[];
}

export type PsychDimension = "sociability" | "resilience" | "reliability" | "coachability" | "flexibility";

export const PSYCH_DIMENSION_NAMES: Record<PsychDimension, string> = {
  sociability: "合群度",
  resilience: "扛事儿",
  reliability: "靠谱度",
  coachability: "听劝度",
  flexibility: "灵活度",
};

export interface PsychInterpretation {
  dimension: PsychDimension;
  name: string;
  interpretation: string;
}

export interface PsychSection {
  interpretations: PsychInterpretation[];
}

export interface QaRecord {
  questionId: string;
  question: string;
  answer: string;
  aiFeedback: {
    strengths: string[];
    improvements: string[];
    suggestedAnswer: string;
  };
}

export interface QaRecordsSection {
  records: QaRecord[];
}

/** AI 面试报告整体结构（admin-hub 主用） */
export interface InterviewReport {
  meta: {
    generatedAt: string;
    candidateName?: string;
    position?: string;
    interviewDate?: string;
  };
  scoreSection: InterviewScore;
  matchingSection: JobMatchingRadar;
  psychSection: PsychSection;
}
