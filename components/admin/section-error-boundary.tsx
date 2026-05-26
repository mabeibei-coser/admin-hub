"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  /** section 中文名，用于错误提示 */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 报告 section 容错容器。单个 section 渲染崩溃只影响它自己，
 * 其它 section 仍然正常。常见崩溃源：上游业务库改了 report_json
 * 字段，admin-hub 这边手抄的 types 没跟上。
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(`[SectionErrorBoundary] ${this.props.name} 渲染失败:`, error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-[var(--amber-200)] bg-[var(--amber-50)] px-5 py-4 text-sm">
          <div className="flex items-center gap-2 mb-1 text-[var(--amber-700)]">
            <AlertTriangle className="size-4" />
            <span className="font-semibold">{this.props.name} 模块数据异常</span>
          </div>
          <p className="text-xs text-muted-foreground">
            可能是上游业务库的报告字段与 admin-hub 类型定义不匹配。其它模块照常显示。
          </p>
          {process.env.NODE_ENV !== "production" && (
            <pre className="mt-2 text-[11px] text-[var(--semantic-danger)] whitespace-pre-wrap font-mono">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
