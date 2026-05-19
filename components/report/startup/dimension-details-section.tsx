"use client";

import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import type { DimensionDetails } from "@/lib/types-startup";

interface Props {
  data: DimensionDetails | null | undefined;
  index: number;
  total: number;
}

const spring = { type: "spring" as const, stiffness: 90, damping: 22 };

export function DimensionDetailsSection({ data, index, total }: Props) {
  const { exporting } = useReportRender();

  if (!data) {
    return (
      <SectionWrapper id="dimensionDetails" title="六维项目诊断" index={index} total={total}>
        <div className="border-t border-[var(--blue-100)] pt-8 pb-4 text-center text-[13px] text-[var(--report-ink-muted)]">
          六维诊断模块生成中…
        </div>
      </SectionWrapper>
    );
  }

  const dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];

  return (
    <SectionWrapper id="dimensionDetails" title="六维项目诊断" index={index} total={total}>
      <div className="divide-y divide-[var(--blue-100)] border-y border-[var(--blue-100)] break-inside-avoid-page">
        {dimensions.map((dim, i) => {
          const rowProps = exporting
            ? {}
            : {
                initial: { opacity: 0, y: 8 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, margin: "-40px" },
                transition: { ...spring, delay: i * 0.04 },
              };
          return (
            <motion.div
              key={dim.dimension}
              {...rowProps}
              className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-6 gap-y-3 py-5 sm:py-6"
            >
              <div className="flex sm:flex-col sm:items-start items-center gap-3 sm:gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--blue-600)] tabular-nums">
                  {String(i + 1).padStart(2, "0")} / 06
                </div>
                <h4
                  className="text-[16px] sm:text-[17px] font-bold text-[var(--navy-950)] leading-tight tracking-tight"
                  style={{ fontFamily: "var(--font-heading-serif)" }}
                >
                  {dim.name}
                </h4>
              </div>

              <div className="space-y-3.5 min-w-0">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Search className="size-3 text-[var(--blue-500)]" strokeWidth={2} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--blue-600)]">
                      项目评估
                    </span>
                  </div>
                  <p className="text-[14px] text-[var(--navy-800)] leading-[1.75]">
                    {dim.assessment}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ArrowRight className="size-3 text-emerald-600" strokeWidth={2} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      发展建议
                    </span>
                  </div>
                  <p className="text-[14px] text-[var(--navy-800)] leading-[1.75]">
                    {dim.suggestion}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
