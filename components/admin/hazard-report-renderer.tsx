"use client";

import type { HazardReportData } from "@/lib/types-hazard";
import { AlertTriangle, AlertCircle, AlertOctagon } from "lucide-react";
import { SectionErrorBoundary } from "@/components/admin/section-error-boundary";

interface Props {
  reportData: HazardReportData | null;
  scenarioLabel?: string | null;
  /** 隐患识别原图 URL。传入时每条隐患左侧渲染同一张照片（admin 档案页用）。 */
  photoUrl?: string | null;
}

// 预算字段末尾常带"元"单位,显示时去掉(如"¥0 - 500 元" → "¥0 - 500")
const stripYuan = (text: unknown): string =>
  (text ?? "").toString().replace(/\s*元\s*$/, "").trim();

/** 隐患等级 → 配色 + 图标 */
const LEVEL_STYLES: Record<string, { bg: string; text: string; ring: string; Icon: typeof AlertTriangle }> = {
  高: {
    bg: "bg-[oklch(0.96_0.05_25)]",
    text: "text-[oklch(0.45_0.18_25)]",
    ring: "ring-[oklch(0.85_0.1_25)]/60",
    Icon: AlertOctagon,
  },
  中: {
    bg: "bg-[var(--amber-100)]",
    text: "text-[var(--amber-700)]",
    ring: "ring-[var(--amber-200)]/60",
    Icon: AlertTriangle,
  },
  低: {
    bg: "bg-[oklch(0.96_0.05_155)]",
    text: "text-[var(--semantic-positive)]",
    ring: "ring-[oklch(0.85_0.08_155)]/40",
    Icon: AlertCircle,
  },
};

export function HazardReportRenderer({ reportData, scenarioLabel, photoUrl }: Props) {
  if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--amber-200)] bg-[var(--amber-50)] px-5 py-4 text-sm text-[var(--amber-700)]">
        报告数据不可用（hazards 数组为空或解析失败）
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部 summary */}
      <div className="rounded-xl border border-[var(--amber-200)]/50 bg-gradient-to-br from-[var(--amber-50)] to-white p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-[var(--amber-100)] to-[var(--amber-50)] text-[var(--amber-700)] flex items-center justify-center ring-1 ring-[var(--amber-200)]/60">
            <AlertTriangle className="size-5" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--navy-900)]">
              {scenarioLabel ?? "通用场景"} · 共识别 {reportData.length} 条隐患
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              按严重程度从高到低排列
            </div>
          </div>
        </div>
      </div>

      {/* 隐患条目列表 */}
      <div className="space-y-3">
        {reportData.map((item, i) => {
          const style = LEVEL_STYLES[item.hazard_level] ?? LEVEL_STYLES["中"];
          const Icon = style.Icon;
          const body = (
            <>
              {/* 标题 + 等级 chip */}
              <div className="flex items-start gap-3 mb-3">
                <div className="size-7 rounded-lg bg-[oklch(0.97_0.02_252_/_0.6)] text-[var(--blue-700)] flex items-center justify-center text-xs font-semibold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-semibold text-[var(--navy-900)] leading-tight">
                      {item.hazard_name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
                    >
                      <Icon className="size-3" strokeWidth={2.4} />
                      {item.hazard_level}风险
                    </span>
                  </div>
                </div>
              </div>

              {/* 描述 */}
              <Field label="隐患描述">{item.hazard_description}</Field>

              {/* 规范 */}
              <Field label="涉及规范" mono>
                {item.relevant_regulations}
              </Field>

              {/* 整改建议 */}
              <Field label="整改建议">
                <ol className="m-0 pl-4 list-decimal space-y-0.5 text-[13px]">
                  {item.rectification_suggestions
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s, j) => (
                      <li key={j}>{s.replace(/^\d+[.、\s]+/, "")}</li>
                    ))}
                </ol>
              </Field>

              {/* 预算 */}
              <Field label="预算经费">
                <span className="font-semibold text-[var(--blue-700)]">
                  {stripYuan(item.estimated_budget)}
                </span>
              </Field>
            </>
          );

          // 有 photoUrl 时两栏：左侧大图 + 右侧文字；无图时仍走单栏
          return (
            <SectionErrorBoundary key={i} name={`隐患条目 #${i + 1}`}>
              <div className="rounded-xl border border-[oklch(0.93_0.006_240)] bg-card p-5 shadow-[0_1px_2px_oklch(0.55_0.2_252_/_0.05)]">
                {photoUrl ? (
                  <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-start">
                    <a
                      href={photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="点击查看原图"
                      className="block rounded-lg overflow-hidden ring-1 ring-border bg-muted hover:ring-[var(--amber-300)] transition-shadow"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- 动态 API 路由 */}
                      <img
                        src={photoUrl}
                        alt="隐患原始照片"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto block"
                      />
                    </a>
                    <div className="min-w-0">{body}</div>
                  </div>
                ) : (
                  body
                )}
              </div>
            </SectionErrorBoundary>
          );
        })}
      </div>
    </div>
  );
}

/** 单条字段：左侧标签 + 右侧内容（移动端堆叠） */
function Field({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 items-baseline py-1.5 border-t border-[oklch(0.96_0.006_240)] first-of-type:border-t-0">
      <div className="text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground font-medium pt-0.5">
        {label}
      </div>
      <div
        className={`text-[13px] text-foreground leading-relaxed ${
          mono ? "font-mono text-[12.5px] text-muted-foreground" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
