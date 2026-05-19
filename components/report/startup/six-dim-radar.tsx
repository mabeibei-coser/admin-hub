"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Overview } from "@/lib/types-startup";

interface SixDimRadarProps {
  data: Overview["sixDimRadar"];
}

interface TickPayload {
  value?: string;
}
interface TickProps {
  x?: string | number;
  y?: string | number;
  cx?: string | number;
  cy?: string | number;
  payload?: TickPayload;
}

function renderRadarTick(props: TickProps) {
  const toNum = (v: string | number | undefined): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v) || 0;
    return 0;
  };
  const x = toNum(props.x);
  const y = toNum(props.y);
  const cx = toNum(props.cx);
  const cy = toNum(props.cy);
  const text = props.payload?.value ?? "";

  let anchor: "start" | "middle" | "end" = "middle";
  const dx = x - cx;
  if (dx < -8) anchor = "end";
  else if (dx > 8) anchor = "start";

  const needWrap = text.length > 5;
  const line1 = needWrap ? text.slice(0, Math.ceil(text.length / 2)) : text;
  const line2 = needWrap ? text.slice(Math.ceil(text.length / 2)) : "";

  const baseStyle = {
    fill: "var(--navy-700)",
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const dy = y < cy ? -4 : 4;

  return (
    <text x={x} y={y + dy} textAnchor={anchor} style={baseStyle}>
      <tspan x={x} dy={needWrap ? "-0.4em" : "0.32em"}>{line1}</tspan>
      {needWrap && (
        <tspan x={x} dy="1.15em">{line2}</tspan>
      )}
    </text>
  );
}

export function SixDimRadar({ data }: SixDimRadarProps) {
  const chartData = (data || []).map((dim) => ({
    subject: dim.name,
    A: dim.score,
    fullMark: 5,
  }));

  return (
    <div className="w-full h-[320px] sm:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="62%"
          data={chartData}
          margin={{ top: 24, right: 60, bottom: 24, left: 60 }}
        >
          <PolarGrid
            gridType="polygon"
            stroke="var(--blue-200)"
            strokeWidth={1}
            fill="var(--blue-50)"
            fillOpacity={0.3}
          />

          <PolarAngleAxis
            dataKey="subject"
            tick={renderRadarTick}
            tickLine={false}
            axisLine={false}
          />

          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "transparent",
            }}
          />

          <Radar
            name="创业诊断评估"
            dataKey="A"
            stroke="var(--blue-600)"
            strokeWidth={3}
            fill="var(--blue-500)"
            fillOpacity={0.5}
            dot={{
              r: 5,
              fill: "var(--blue-600)",
              stroke: "#fff",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 7,
              fill: "var(--blue-700)",
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />

          <Legend
            wrapperStyle={{
              paddingTop: "10px",
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--navy-900)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
