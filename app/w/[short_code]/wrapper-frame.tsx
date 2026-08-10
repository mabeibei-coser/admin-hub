"use client";

import { useEffect, useState } from "react";

const TOP_MASK_HEIGHT = 54;
const FOOTER_MASK_HEIGHT = 34;

interface Props {
  sourceUrl: string;
  title: string;
  footerText: string;
}

export function WrapperFrame({ sourceUrl, title, footerText }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [sourceUrl]);

  return (
    <main className="wp-stage">
      <div className="wp-shell">
        <div className="wp-canvas">
          <iframe
            className="wp-frame"
            src={sourceUrl}
            title={title}
            referrerPolicy="no-referrer"
            allow="microphone"
            onLoad={() => {
              setLoaded(true);
              setTimedOut(false);
            }}
          />
          <div className="wp-top-mask" aria-hidden="true" />
          <footer className="wp-footer-mask" title={footerText}>
            <span>{footerText}</span>
          </footer>
        </div>

        {!loaded && !timedOut && (
          <div className="wp-loading" role="status" aria-live="polite">
            正在打开智能体…
          </div>
        )}
        {!loaded && timedOut && (
          <div className="wp-fallback" role="alert">
            <p>智能体页面暂未显示。</p>
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              打开原始智能体
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        .wp-stage {
          position: fixed;
          inset: 0;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          overflow: hidden;
          background: #ffffff;
          color: #374151;
          color-scheme: light;
        }
        .wp-shell {
          position: relative;
          flex: none;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #ffffff;
        }
        .wp-canvas {
          position: absolute;
          inset: 0;
          background: #ffffff;
        }
        .wp-frame {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #ffffff;
        }
        .wp-top-mask {
          position: absolute;
          z-index: 2;
          inset: 0 0 auto;
          height: ${TOP_MASK_HEIGHT}px;
          background: #ffffff;
        }
        .wp-footer-mask {
          position: absolute;
          z-index: 2;
          inset: auto 0 0;
          box-sizing: border-box;
          height: ${FOOTER_MASK_HEIGHT}px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          overflow: hidden;
          border-top: 1px solid #f1f3f5;
          background: #ffffff;
          color: #8a9099;
          font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
        }
        .wp-footer-mask span {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          white-space: normal;
        }
        .wp-loading,
        .wp-fallback {
          position: absolute;
          z-index: 3;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: #7a818c;
          font: 14px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
        }
        .wp-fallback {
          flex-direction: column;
          gap: 10px;
        }
        .wp-fallback p {
          margin: 0;
        }
        .wp-fallback a {
          color: #255fbd;
          text-underline-offset: 3px;
        }
      `}</style>
    </main>
  );
}
