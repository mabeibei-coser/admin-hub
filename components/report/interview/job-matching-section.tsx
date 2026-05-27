"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import type { JobMatchingRadar } from "@/lib/types-interview";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: JobMatchingRadar | null | undefined;
  index: number;
  total: number;
}

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** 根据分数获取等级标签和颜色 */
function getScoreLevel(score: number) {
  if (score >= 9) return { label: "卓越", color: "text-emerald-700", bgColor: "bg-emerald-500", lightBg: "bg-emerald-50" };
  if (score >= 7) return { label: "优秀", color: "text-blue-700", bgColor: "bg-blue-500", lightBg: "bg-blue-50" };
  if (score >= 5) return { label: "良好", color: "text-amber-700", bgColor: "bg-amber-500", lightBg: "bg-amber-50" };
  return { label: "待提升", color: "text-red-700", bgColor: "bg-red-500", lightBg: "bg-red-50" };
}

export function JobMatchingSection({ data, index, total }: Props) {
  const { exporting } = useReportRender();

  if (!data || !data.dimensions || data.dimensions.length === 0) {
    return (
      <SectionWrapper id="job-matching" title="岗位匹配度" index={index} total={total}>
        <div className="rounded-xl border border-dashed border-[var(--blue-200)] bg-[var(--blue-50)]/40 px-5 py-8 text-center text-[13.5px] text-[var(--report-ink-muted)]">
          ⏳ 岗位匹配度分析中…
        </div>
      </SectionWrapper>
    );
  }

  const { dimensions, suggestions } = data;

  // 转换数据格式为 recharts 所需
  const chartData = (dimensions || []).map((dim) => ({
    subject: dim.name,
    score: dim.score,
    fullMark: 10,
  }));

  const fadeIn = exporting
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: cubicEase },
      };

  return (
    <SectionWrapper id="job-matching" title="岗位匹配度" index={index} total={total}>
      <motion.div {...fadeIn} className="space-y-6">
        {/* 新布局：左侧（雷达图 + 发展建议）+ 右侧（5 项能力详情） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：上半部分是雷达图，下半部分是发展建议 */}
          <div className="space-y-4">
            {/* 雷达图 */}
            <div className="rounded-xl border border-[var(--blue-100)] bg-white p-4 break-inside-avoid">
              <div className="text-center mb-2">
                <span className="text-[11px] uppercase tracking-wider text-[var(--report-ink-muted)]">
                  能力雷达图
                </span>
              </div>
              <div className="w-full h-[240px] sm:h-[260px]" style={{ minHeight: "240px", position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid
                      gridType="polygon"
                      stroke="var(--blue-200)"
                      strokeWidth={1}
                      fill="var(--blue-50)"
                      fillOpacity={0.3}
                    />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{
                        fill: "var(--navy-700)",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 10]}
                      tick={{
                        fill: "var(--report-ink-muted)",
                        fontSize: 10,
                      }}
                      tickCount={6}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Radar
                      name="岗位匹配度"
                      dataKey="score"
                      stroke="var(--blue-600)"
                      strokeWidth={2.5}
                      fill="var(--blue-500)"
                      fillOpacity={0.4}
                      dot={{
                        r: 4,
                        fill: "var(--blue-600)",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: "var(--blue-700)",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 发展建议 */}
            {suggestions && suggestions.length > 0 && (
              <div className="rounded-xl border border-[var(--blue-100)] bg-gradient-to-br from-[var(--blue-50)]/60 to-white p-4 break-inside-avoid">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-[var(--blue-600)]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                  </svg>
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--report-ink-muted)]">
                    发展建议
                  </span>
                </div>
                <ul className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--blue-500)] text-white text-[11px] font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[14px] text-[var(--navy-700)] leading-relaxed">
                        {suggestion}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 右侧：5 项能力详情卡片 */}
          <div className="space-y-3">
            {dimensions.map((dim, idx) => {
              const level = getScoreLevel(dim.score);
              return (
                <div
                  key={dim.dimension}
                  className="group rounded-lg border border-[var(--blue-100)] bg-white p-3.5 transition-all duration-200 hover:shadow-md hover:border-[var(--blue-200)]"
                >
                  {/* 能力名 + 分数 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${level.bgColor} text-white text-[11px] font-bold`}
                      >
                        {idx + 1}
                      </div>
                      <span className="text-[14px] font-semibold text-[var(--navy-900)]">
                        {dim.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${level.lightBg} ${level.color}`}>
                        {level.label}
                      </span>
                      <span className="text-[15px] font-bold text-[var(--navy-700)]">
                        {dim.score.toFixed(0)}
                        <span className="text-[11px] font-normal text-[var(--report-ink-muted)]">/10</span>
                      </span>
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div className="relative h-2 bg-[var(--blue-50)] rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${level.bgColor} transition-all duration-700`}
                      style={{ width: `${dim.score * 10}%` }}
                    />
                  </div>

                  {/* 优秀表现 */}
                  {dim.excellentPerformance && (
                    <div className="mt-2.5 p-2.5 rounded-md bg-[var(--blue-50)]/60 border border-[var(--blue-100)]">
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3.5 h-3.5 text-[var(--blue-500)] mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <p className="text-[12px] text-[var(--navy-700)] leading-relaxed">
                          <span className="font-medium text-[var(--blue-700)]">优秀表现：</span>
                          {dim.excellentPerformance}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </SectionWrapper>
  );
}
