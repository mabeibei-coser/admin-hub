"use client";

import { motion } from "framer-motion";
import { useReportRender } from "./report-context";

interface ScoreRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
}

export function ScoreRing({
  value,
  max = 5,
  size = 96,
  stroke = 7,
}: ScoreRingProps) {
  const { exporting } = useReportRender();

  const ratio = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - ratio);

  const tone =
    value >= 4 ? "优秀"
    : value >= 3.5 ? "良好"
    : value >= 2.5 ? "中等"
    : value >= 1.5 ? "待加强"
    : "需关注";

  const ringProps = exporting
    ? { strokeDashoffset: offset }
    : {
        initial: { strokeDashoffset: circumference },
        animate: { strokeDashoffset: offset },
        transition: { type: "spring" as const, stiffness: 90, damping: 22, delay: 0.15 },
      };

  const breatheProps = exporting
    ? {}
    : {
        animate: { scale: [1, 1.012, 1] },
        transition: { duration: 4.8, repeat: Infinity, ease: "easeInOut" as const },
      };

  return (
    <motion.div
      {...breatheProps}
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <defs>
          <linearGradient
            id={`score-ring-gradient-${size}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--blue-400)" />
            <stop offset="55%" stopColor="var(--blue-600)" />
            <stop offset="100%" stopColor="var(--blue-700)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--blue-100)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#score-ring-gradient-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          fill="none"
          {...ringProps}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[26px] font-bold text-[var(--navy-900)] tabular-nums tracking-tight">
          {value.toFixed(1)}
        </span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--blue-600)]">
          {tone}
        </span>
      </div>
    </motion.div>
  );
}
