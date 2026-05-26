/**
 * ⚠️ 自动生成文件，不要手改。
 * 来源：career-report/contracts/career-report.ts
 * 同步命令：npm run sync-contracts report
 *
 * 想改这份 types，先去 career-report 项目改 contracts/career-report.ts，
 * 再来 admin-hub 跑 sync，然后 commit + 部署。两边任何一边单独改都不算数。
 * 上次同步：2026-05-26T14:30:15.102Z
 */

// ========== 表单输入类型 ==========

export interface JobFormData {
  targetPosition: string;
  targetEducation: string;
  targetCompany: string;
  targetCityTier: string;
  resumeText?: string;
  resumeFileName?: string;
}

// ========== 职业测评类型 ==========

export type QuizDimension = "E-I" | "S-N" | "T-F" | "J-P" | "risk" | "value";

export interface QuizOption {
  key: "A" | "B" | "C" | "D";
  label: string;
  score: Partial<Record<string, number>>;
}

export interface QuizQuestion {
  id: string;
  dimension: QuizDimension;
  question: string;
  options: QuizOption[];
}

export interface QuizAnswer {
  questionId: string;
  dimension: QuizDimension;
  selectedKey: "A" | "B" | "C" | "D";
  questionText: string;
  selectedLabel: string;
}

// ========== 报告类型 ==========

export type ReportSectionKey =
  | "overview"
  | "salary"
  | "positionInfo"
  | "resumeDiagnosis"
  | "salaryNegotiation"
  | "workplaceInsight";

export interface ReportData {
  meta: ReportMeta;
  overview: Overview;
  salary: SalaryInsight;
  positionInfo: PositionInfo;
  resumeDiagnosis: ResumeDiagnosis | null;
  salaryNegotiation: NegotiationTips;
  workplaceInsight: WorkplaceInsight;
}

export interface ReportMeta {
  generatedAt: string;
  formData: JobFormData;
  quizSummary: string;
  hasResume: boolean;
}

// 总览：一句定位判断 + 综述 + 一条优势 + 一条改进 + 职业性格总结
export interface Overview {
  positioning: string; // 20-35 字的一句定位判断（作为 section takeaway）
  summary: string; // 2-3 句综述
  strength: { title: string; detail: string };
  improvement: { title: string; detail: string };
  personality: {
    type: string; // 例："ENFJ · 温和型推动者"
    traits: string[]; // 3-4 个标签
    description: string; // 80-120 字
  };
}

export interface SalaryInsight {
  quartiles: {
    low: number;
    median: number;
    high: number;
    unit: string;
  };
  industryComparison: {
    industry: string;
    avgSalary: number;
  }[];
  // 用户意向所在行业（基于 targetCompany 推断），单独呈现
  userIndustry?: {
    industry: string;
    avgSalary: number;
    note?: string; // 一句定位话，如"比行业中位高 X%"或"岗位稀缺但稳定"
  };
  cityCoefficient: {
    tier: string;
    coefficient: number;
    sampleCity: string;
    isUserTier: boolean;
  }[];
}

export interface PositionInfo {
  subPositions: {
    name: string;
    priority: "primary" | "secondary";
    coreResponsibilities: string[];
    coreCompetencies: {
      name: string;
      score: number;
      description: string;
    }[];
    fitReason: string; // 80-120 字，基于测评 + 简历，说明为什么适合这位候选人
  }[];
}

export interface ResumeDiagnosis {
  overallScore: number;
  recommendations: {
    title: string;
    issue: string;
    suggestion: string;
    priority: "high" | "medium" | "low";
    quotedSnippet?: string;
  }[];
}

// 谈薪要点：只讲 2 个主题的 summary（AI 应用经验 + AI 相关的企业实习成果）
export interface NegotiationTips {
  aiExperience: {
    summary: string;
  };
  internshipExperience: {
    summary: string;
  };
}

// 职场环境透视：行业建议 + 意向公司观察 + 综合建议
export interface WorkplaceInsight {
  industryAdvice: {
    summary: string;
  };
  companyInsight: {
    targetLabel: string; // 用户填的意向公司/类型名，原样回显
    developmentSummary: string; // 80-150 字：该公司近 12 个月发展现状
    summary: string; // 观察来源说明（脉脉/小红书/知乎等公开渠道+时间范围）
    observations: {
      source: string; // 例：脉脉常见吐槽 / 小红书 / 校招贴吧
      voice: string; // 一段"拟真"观察
    }[]; // 3-4 条
    attentions: string[]; // 2-3 条要重点注意的事项
  };
  synthesis: string; // 综合给出的一段话
}

// ========== 访谈类型 ==========

export interface InterviewTurn {
  index: 0 | 1;
  questionText: string;
  userAnswerText: string;
  inputMethod: "voice" | "text";
  audioDurationSec?: number;
}

export interface InterviewData {
  turns: InterviewTurn[];
  summary: string;
  skipped: boolean;
  generatedAt: string;
}
