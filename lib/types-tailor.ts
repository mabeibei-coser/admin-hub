/**
 * ⚠️ 自动生成文件，不要手改。
 * 来源：resume-tailor/contracts/resume-tailor.ts
 * 同步命令：npm run sync-contracts tailor
 *
 * 想改这份 types，先去 resume-tailor 项目改 contracts/resume-tailor.ts，
 * 再来 admin-hub 跑 sync，然后 commit + 部署。两边任何一边单独改都不算数。
 * 上次同步：2026-05-26T14:30:15.102Z
 */

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
