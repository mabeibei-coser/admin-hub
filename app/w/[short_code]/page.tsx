import { notFound } from "next/navigation";
import { after } from "next/server";
import type { Metadata } from "next";
import {
  findActiveWrapperByShortCode,
  findWrapperByShortCode,
  incrementClickCount,
} from "@/lib/wrappers-db";
import { RefreshButton } from "./refresh-button";

interface Props {
  params: Promise<{ short_code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { short_code } = await params;
  const w = findActiveWrapperByShortCode(short_code);
  if (!w) {
    const any = findWrapperByShortCode(short_code);
    if (any) {
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
    description: w.note,
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
    if (any) {
      // 410 Gone — 已停用
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
            minHeight: "100vh",
            border: "1px solid #e5e7eb",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>该智能体已停用</h1>
          <p style={{ color: "#666", marginTop: 12, fontSize: 14 }}>
            请联系管理员恢复或更换链接。
          </p>
          <p style={{ color: "#9ca3af", marginTop: 8, fontSize: 13 }}>
            短码：{any.short_code}
          </p>
        </div>
      );
    }
    // 404
    notFound();
  }

  // 响应发送后异步计数 +1
  after(() => {
    incrementClickCount(wrapper.id);
  });

  return (
    <div id="wrapper-page">
      <style>{`
        #wrapper-page {
          max-width: 1024px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: #fff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        #wrapper-page .wp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
        }
        #wrapper-page .wp-header h1 {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          color: #1f2937;
        }
        #wrapper-page .wp-refresh {
          padding: 8px 16px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          transition: background 0.15s;
        }
        #wrapper-page .wp-refresh:hover {
          background: #1d4ed8;
        }
        #wrapper-page .wp-iframe-wrap {
          flex: 1;
          display: flex;
        }
        #wrapper-page .wp-iframe {
          width: 100%;
          height: 100%;
          border: none;
          min-height: 70vh;
        }
        #wrapper-page .wp-footer {
          padding: 12px 24px;
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
          border-top: 1px solid #e5e7eb;
          white-space: pre-wrap;
          line-height: 1.6;
        }

        /* 响应式：小屏幕全宽 */
        @media (max-width: 768px) {
          #wrapper-page {
            max-width: 100%;
            border: none;
            box-shadow: none;
          }
          #wrapper-page .wp-header {
            padding: 12px 16px;
          }
          #wrapper-page .wp-header h1 {
            font-size: 16px;
          }
          #wrapper-page .wp-footer {
            padding: 10px 16px;
            font-size: 12px;
          }
        }
      `}</style>

      <header className="wp-header">
        <h1>{wrapper.name}</h1>
        <RefreshButton />
      </header>

      <main className="wp-iframe-wrap">
        <iframe
          className="wp-iframe"
          src={wrapper.source_url}
          title={wrapper.name}
          // sandbox: allow-scripts + allow-same-origin 同时使用会减弱隔离（见 plan 权衡说明）
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer-when-downgrade"
          allow="microphone"
        />
      </main>

      <footer className="wp-footer">{wrapper.footer_text}</footer>
    </div>
  );
}
