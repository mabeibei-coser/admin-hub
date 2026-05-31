"use client";

import { useState } from "react";
import { Presentation, MessageSquareText, ImageOff } from "lucide-react";
import {
  type TeachingReport,
  type CoursewareReport,
  type InteractionReport,
  TEACHING_LINE_LABELS,
} from "@/lib/types-teaching";
import { SectionErrorBoundary } from "@/components/admin/section-error-boundary";

interface Props {
  reportData: TeachingReport | null;
  /** "courseware" | "interaction"，来自 reports.type 列 */
  type: string | null;
}

/** 互动方案各段字段的中文标签（英文 key → 中文）。命中则显示中文，否则回退 key。 */
const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  scenario: "情境描述",
  coreQuestions: "核心问题",
  guidingQuestions: "引导问题",
  affirmativePosition: "正方立场",
  negativePosition: "反方立场",
  roles: "角色设定",
  inquiryQuestions: "探究问题",
  methods: "建议方法",
  problemDescription: "问题描述",
  constraints: "约束条件",
  coreArguments: "核心论点",
  multiplePerspectives: "多元视角",
  evaluationDimensions: "评价维度",
  knowledgePoints: "知识点",
  teachingSuggestions: "教学建议",
  extendedThinking: "延伸思考",
  name: "角色名",
  description: "角色背景",
  task: "目标任务",
  traits: "性格特征",
};

const SECTION_META: Record<string, { title: string }> = {
  caseContent: { title: "互动内容" },
  referenceAnswer: { title: "参考答案" },
  keyPoints: { title: "核心要点" },
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** 渲染单个字段值：字符串→段落，字符串数组→有序列表，对象数组→角色卡，对象→嵌套字段 */
function FieldValue({ value }: { value: unknown }) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "string" || typeof value === "number") {
    return (
      <p className="text-[13.5px] text-foreground leading-relaxed whitespace-pre-wrap">
        {String(value)}
      </p>
    );
  }
  if (Array.isArray(value)) {
    // 对象数组（如 roles）→ 每个对象一张小卡
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      return (
        <div className="space-y-2">
          {value.map((item, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--report-divider)] bg-[var(--surface-tinted)] p-3 space-y-1.5"
            >
              {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {labelFor(k)}
                  </span>
                  <FieldValue value={v} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    // 字符串数组 → 有序列表
    return (
      <ol className="m-0 pl-4 list-decimal space-y-1 text-[13.5px] text-foreground leading-relaxed">
        {(value as unknown[]).map((v, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-1.5">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[88px_1fr] gap-2 items-baseline">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {labelFor(k)}
            </span>
            <FieldValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

/** 互动方案一段（caseContent / referenceAnswer / keyPoints） */
function InteractionSection({
  sectionKey,
  data,
  index,
  total,
}: {
  sectionKey: string;
  data: Record<string, unknown>;
  index: number;
  total: number;
}) {
  const meta = SECTION_META[sectionKey] ?? { title: sectionKey };
  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="size-6 rounded-lg bg-[var(--indigo-100)] text-[var(--indigo-700)] flex items-center justify-center text-xs font-semibold">
          {index}
        </span>
        <h2 className="text-[15px] font-semibold text-[var(--navy-900)]">{meta.title}</h2>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
          {index} / {total}
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="border-t border-[var(--report-divider)] pt-2.5 first-of-type:border-t-0 first-of-type:pt-0">
            <div className="text-[12px] font-medium text-[var(--indigo-700)] mb-1">{labelFor(k)}</div>
            <FieldValue value={v} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** 课件创作：一张生成图 + 元信息 chips + 修订提示词 */
function CoursewareView({ data }: { data: CoursewareReport }) {
  const [imgError, setImgError] = useState(false);
  const chips = [
    data.cardType,
    data.cardStyle,
    data.cardSize,
    data.line ? TEACHING_LINE_LABELS[data.line] ?? data.line : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <section className="surface-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-6 rounded-lg bg-[var(--indigo-100)] text-[var(--indigo-700)] flex items-center justify-center">
            <Presentation className="size-3.5" />
          </span>
          <h2 className="text-[15px] font-semibold text-[var(--navy-900)]">课件图片</h2>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {chips.map((c) => (
              <span
                key={c}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--indigo-50)] text-[var(--indigo-700)] ring-1 ring-[var(--indigo-200)]/60"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {data.imageDataUrl && !imgError ? (
          <div className="rounded-xl overflow-hidden ring-1 ring-[var(--report-border)] bg-[var(--surface-tinted)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- base64 dataURL，next/image 无法优化 */}
            <img
              src={data.imageDataUrl}
              alt="生成课件图片"
              className="w-full h-auto block"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <ImageOff className="size-8" />
            <span className="text-sm">课件图片不可用</span>
          </div>
        )}
      </section>

      {data.revisedPrompt && (
        <section className="surface-panel p-5">
          <h2 className="text-[15px] font-semibold text-[var(--navy-900)] mb-3">模型修订提示词</h2>
          <pre className="text-[12.5px] text-muted-foreground bg-[var(--surface-tinted)] border border-[var(--report-divider)] rounded-lg p-3 whitespace-pre-wrap leading-relaxed font-mono">
            {data.revisedPrompt}
          </pre>
        </section>
      )}
    </div>
  );
}

/** 课堂互动方案截图（用户端 html2canvas 上传）—— 详情页预览 */
function InteractionScreenshot({ src }: { src: string }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) return null;
  return (
    <section className="surface-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="size-6 rounded-lg bg-[var(--indigo-100)] text-[var(--indigo-700)] flex items-center justify-center">
          <Presentation className="size-3.5" />
        </span>
        <h2 className="text-[15px] font-semibold text-[var(--navy-900)]">方案截图</h2>
      </div>
      <div className="rounded-xl overflow-hidden ring-1 ring-[var(--report-border)] bg-[var(--surface-tinted)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- base64 dataURL，next/image 无法优化 */}
        <img
          src={src}
          alt="互动方案截图"
          className="w-full h-auto block"
          onError={() => setImgError(true)}
        />
      </div>
    </section>
  );
}

export function TeachingReportRenderer({ reportData, type }: Props) {
  if (!reportData) {
    return (
      <div className="rounded-xl border border-[var(--indigo-200)] bg-[var(--indigo-50)] px-5 py-4 text-sm text-[var(--indigo-700)]">
        报告数据不可用（report_json 为空或解析失败）
      </div>
    );
  }

  // 课件：有 imageDataUrl 字段
  if (type === "courseware" || "imageDataUrl" in reportData) {
    return <CoursewareView data={reportData as CoursewareReport} />;
  }

  // 课堂互动：三段式
  const interaction = reportData as InteractionReport;
  const sections = (["caseContent", "referenceAnswer", "keyPoints"] as const).filter(
    (k) => interaction[k] && typeof interaction[k] === "object"
  );
  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--indigo-200)] bg-[var(--indigo-50)] px-5 py-4 text-sm text-[var(--indigo-700)]">
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4" />
          互动方案结构无法识别
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {sections.map((k, i) => (
        <SectionErrorBoundary key={k} name={SECTION_META[k]?.title ?? k}>
          <InteractionSection
            sectionKey={k}
            data={interaction[k] as Record<string, unknown>}
            index={i + 1}
            total={sections.length}
          />
        </SectionErrorBoundary>
      ))}
      {interaction.screenshotImage && (
        <InteractionScreenshot src={interaction.screenshotImage} />
      )}
    </div>
  );
}
