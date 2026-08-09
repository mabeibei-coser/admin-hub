"use client";

import { useEffect, useState } from "react";

const COMPACT_DESIGN_WIDTH = 840;
const WIDE_DESIGN_WIDTH = 1024;
const TOP_MASK_HEIGHT = 54;
const FOOTER_MASK_HEIGHT = 34;

interface FrameMetrics {
  ready: boolean;
  scale: number;
  shellWidth: number;
  canvasWidth: number;
  viewportHeight: number;
  canvasHeight: number;
}

interface Props {
  sourceUrl: string;
  title: string;
  footerText: string;
}

const INITIAL_METRICS: FrameMetrics = {
  ready: false,
  scale: 1,
  shellWidth: COMPACT_DESIGN_WIDTH,
  canvasWidth: COMPACT_DESIGN_WIDTH,
  viewportHeight: 720,
  canvasHeight: 720,
};

export function WrapperFrame({ sourceUrl, title, footerText }: Props) {
  const [metrics, setMetrics] = useState<FrameMetrics>(INITIAL_METRICS);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    function measure() {
      const viewportWidth = Math.max(1, document.documentElement.clientWidth);
      const viewportHeight = Math.max(
        1,
        Math.round(window.visualViewport?.height ?? window.innerHeight),
      );
      const canvasWidth = viewportWidth >= WIDE_DESIGN_WIDTH
        ? WIDE_DESIGN_WIDTH
        : COMPACT_DESIGN_WIDTH;
      const scale = Math.min(1, viewportWidth / canvasWidth);

      setMetrics({
        ready: true,
        scale,
        shellWidth: Math.round(canvasWidth * scale),
        canvasWidth,
        viewportHeight,
        canvasHeight: Math.ceil(viewportHeight / scale),
      });
    }

    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [sourceUrl]);

  return (
    <main className="wp-stage">
      <div
        className="wp-shell"
        style={{
          width: metrics.ready ? metrics.shellWidth : "100%",
          height: metrics.viewportHeight,
        }}
      >
        <div
          className="wp-canvas"
          style={{
            width: metrics.canvasWidth,
            height: metrics.canvasHeight,
            transform: `scale(${metrics.scale})`,
            visibility: metrics.ready ? "visible" : "hidden",
          }}
        >
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

        {(!metrics.ready || !loaded) && !timedOut && (
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
          overflow: hidden;
          background: #ffffff;
        }
        .wp-canvas {
          position: absolute;
          inset: 0 auto auto 0;
          transform-origin: top left;
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
