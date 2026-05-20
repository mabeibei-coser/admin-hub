// admin-hub × resume-tailor 类型文件
// 物理复制自 resume-tailor/lib/types.ts（无法 import 跨 repo）
// 只保留报告渲染需要的部分，去掉 Zod schema（admin-hub 不做入口校验）

export type TailorMode = "moderate" | "aggressive";

export interface TailorFormData {
  jobTitle: string;
  jd: string;
  resumeFilename?: string;
  mode: TailorMode;
}

export interface TailorSuggestion {
  title: string;
  problem: string;
  action: string;
  example: string;
}

export interface TailorInterviewQuestion {
  question: string;
  why: string;
  sampleAnswer: string;
  keypoints: string[];
}

export type DiffAction = "replace" | "append" | "delete";

export interface DiffChange {
  path: string;
  action: DiffAction;
  oldText?: string;
  newText: string;
  reason: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface ResumeBasics {
  name: string;
  label?: string;
  email?: string;
  phone?: string;
  summary?: string;
  birthday?: string;
  yearsOfExperience?: string;
  hometown?: string;
}

export interface ResumeWork {
  name: string;
  position: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
  location?: string;
}

export interface ResumeEducation {
  institution: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
}

export interface ResumeSkill {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface ResumeProject {
  name: string;
  description?: string;
  highlights?: string[];
  startDate?: string;
  endDate?: string;
}

export interface ResumeJSON {
  basics: ResumeBasics;
  work?: ResumeWork[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  projects?: ResumeProject[];
  [key: string]: unknown;
}

export interface TailorReport {
  suggestions: TailorSuggestion[];
  interview: TailorInterviewQuestion[];
  resume: ResumeJSON;
  changes: DiffChange[];
  fallback?: boolean;
}
