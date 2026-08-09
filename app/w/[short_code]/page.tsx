import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  findActiveWrapperByShortCode,
  findWrapperByShortCode,
} from "@/lib/wrappers-db";
import { WrapperFrame } from "./wrapper-frame";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ short_code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { short_code } = await params;
  const w = findActiveWrapperByShortCode(short_code);
  if (!w) {
    const any = findWrapperByShortCode(short_code);
    if (any?.status === "disabled") {
      return {
        title: `${any.name} - 已停用`,
        robots: { index: false, follow: false },
      };
    }
    return {
      title: "智能体",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: w.name,
    description: "智能体在线问答",
    robots: { index: false, follow: false },
  };
}

export default async function WrapperPage({ params }: Props) {
  const { short_code } = await params;

  // 先查 active
  const wrapper = findActiveWrapperByShortCode(short_code);
  if (!wrapper) {
    // 再查是否存在（disabled 回来的情况）
    const any = findWrapperByShortCode(short_code);
    if (any?.status === "disabled") {
      // 已停用提示页
      return (
        <div
          id="wrapper-page"
          style={{
            maxWidth: 1024,
            margin: "0 auto",
            padding: "60px 20px",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#fff",
            minHeight: "100dvh",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>该智能体已停用</h1>
          <p style={{ color: "#666", marginTop: 12, fontSize: 14 }}>
            请联系管理员恢复或更换链接。
          </p>
          <p style={{ color: "#9ca3af", marginTop: 8, fontSize: 13 }}>
            访问后缀：{any.short_code}
          </p>
        </div>
      );
    }
    // 404
    notFound();
  }

  return (
    <WrapperFrame
      key={wrapper.source_url}
      sourceUrl={wrapper.source_url}
      title={wrapper.name}
      footerText={wrapper.footer_text}
    />
  );
}
