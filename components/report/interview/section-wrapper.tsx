"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReportRender } from "./report-context";

export interface SectionWrapperProps {
  id?: string;
  title: string;
  index: number;
  total: number;
  takeaway?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function SectionWrapper({
  id,
  title,
  index,
  total,
  takeaway,
  meta,
  children,
  delay = 0,
  className,
}: SectionWrapperProps) {
  const { exporting } = useReportRender();
  const Wrapper = exporting ? "section" : motion.section;
  const motionProps = exporting
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay, ease },
      };

  const paddedIndex = String(index).padStart(2, "0");
  const paddedTotal = String(total).padStart(2, "0");

  return (
    <Wrapper
      id={id}
      data-pdf-section={id ?? title}
      {...motionProps}
      className={cn(
        "report-card p-4 sm:p-5 break-inside-avoid-page",
        className
      )}
    >
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex h-5 items-center rounded-full bg-[var(--blue-500)] px-2 text-[10px] font-semibold text-white tabular-nums">
            {paddedIndex} / {paddedTotal}
          </span>
          <span className="text-[10px] text-[var(--report-ink-muted)] uppercase tracking-wider">
            Section
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-[var(--navy-950)] tracking-tight">
            {title}
          </h2>
          {meta && (
            <div className="text-[12px] text-[var(--report-ink-muted)]">
              {meta}
            </div>
          )}
        </div>
        {takeaway && (
          <p className="report-takeaway mt-3">{takeaway}</p>
        )}
      </header>
      {children}
    </Wrapper>
  );
}
