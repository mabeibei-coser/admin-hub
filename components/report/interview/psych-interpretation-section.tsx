"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import type { PsychSection } from "@/lib/types-interview";

interface Props {
  data: PsychSection | null | undefined;
  index: number;
  total: number;
}

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** 职场五力图标映射 */
function getPsychIcon(dimension: string) {
  switch (dimension) {
    case "sociability":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      );
    case "resilience":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
      );
    case "reliability":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      );
    case "coachability":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12v9c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-9c0-5.52-4.48-10-10-10zm0 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      );
    case "flexibility":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
      );
    default:
      return null;
  }
}

/** 职场五力配置：颜色 */
const PSYCH_CONFIG = [
  { dimension: "sociability", name: "合群度", color: "var(--blue-500)", gradient: "from-blue-500 to-blue-600" },
  { dimension: "resilience", name: "扛事儿", color: "var(--emerald-500)", gradient: "from-emerald-500 to-emerald-600" },
  { dimension: "reliability", name: "靠谱度", color: "var(--indigo-500)", gradient: "from-indigo-500 to-indigo-600" },
  { dimension: "coachability", name: "听劝度", color: "var(--amber-500)", gradient: "from-amber-500 to-amber-600" },
  { dimension: "flexibility", name: "灵活度", color: "var(--purple-500)", gradient: "from-purple-500 to-purple-600" },
];

/** 根据解读文本推断力程度等级（1-5） */
function inferLevel(interpretation: string): number {
  const positiveWords = ["很好", "非常好", "优秀", "出色", "强", "高", "充分", "出色", "善于", "擅长"];
  const neutralWords = ["还可以", "还行", "一般", "中等", "基本", "尚可"];
  const negativeWords = ["不足", "较弱", "需要提升", "待加强", "欠缺"];

  let score = 3;
  positiveWords.forEach(word => { if (interpretation.includes(word)) score = Math.max(score, 4); });
  neutralWords.forEach(word => { if (interpretation.includes(word)) score = Math.min(Math.max(score, 3), 3); });
  negativeWords.forEach(word => { if (interpretation.includes(word)) score = Math.min(score, 2); });

  return score;
}

/** 生成解读提示 */
function getInterpretationTip(dimension: string): string {
  const tips: Record<string, string> = {
    sociability: "团队协作的关键素质",
    resilience: "决定职业发展的持久性",
    reliability: "职场信任的基础",
    coachability: "决定进步速度",
    flexibility: "快速迭代环境中尤为重要",
  };
  return tips[dimension] || "职场核心素质之一";
}

interface ForceRowProps {
  item: PsychSection["interpretations"][0];
  index: number;
}

/** 单个力的表格行组件 */
function ForceRow({ item, index }: ForceRowProps) {
  const config = PSYCH_CONFIG.find(c => c.dimension === item.dimension) || PSYCH_CONFIG[index % PSYCH_CONFIG.length];
  const level = inferLevel(item.interpretation);
  const tip = getInterpretationTip(item.dimension);

  return (
    <div className="group flex items-center gap-4 p-3 rounded-lg border border-[var(--blue-100)] bg-white transition-all duration-200 hover:shadow-md hover:border-[var(--blue-200)]">
      {/* 图标 + 名称 */}
      <div className="flex items-center gap-2.5 min-w-[120px]">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${config.gradient} text-white shadow-sm flex-shrink-0`}
        >
          {getPsychIcon(item.dimension)}
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[var(--navy-900)]">
            {item.name}
          </div>
        </div>
      </div>

      {/* 指数进度条 */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[var(--report-ink-muted)]">指数</span>
          <span className="text-[12px] font-semibold text-[var(--navy-700)]">
            {level} / 5
          </span>
        </div>
        <div className="relative h-2 bg-[var(--blue-50)] rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
            style={{ width: `${(level / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* 解读文本 */}
      <div className="flex-1 min-w-[180px]">
        <p className="text-[13px] text-[var(--navy-700)] leading-relaxed">
          {item.interpretation}
        </p>
      </div>

      {/* 提示 */}
      <div className="hidden lg:block min-w-[120px]">
        <p className="text-[11px] text-[var(--report-ink-muted)]">
          {tip}
        </p>
      </div>
    </div>
  );
}

export function PsychInterpretationSection({ data, index, total }: Props) {
  const { exporting } = useReportRender();

  if (!data) {
    return (
      <SectionWrapper id="psych-interpretation" title="职场五力解读" index={index} total={total}>
        <div className="rounded-xl border border-dashed border-[var(--blue-200)] bg-[var(--blue-50)]/40 px-5 py-8 text-center text-[13.5px] text-[var(--report-ink-muted)]">
          ⏳ 职场五力解读生成中…
        </div>
      </SectionWrapper>
    );
  }

  const { interpretations } = data;

  const fadeIn = exporting
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: cubicEase },
      };

  return (
    <SectionWrapper id="psych-interpretation" title="职场五力解读" index={index} total={total}>
      <motion.div {...fadeIn} className="space-y-3">
        {interpretations.map((item, idx) => (
          <ForceRow key={item.dimension} item={item} index={idx} />
        ))}
      </motion.div>
    </SectionWrapper>
  );
}
