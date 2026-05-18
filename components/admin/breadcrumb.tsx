import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Breadcrumb — 后台统一的面包屑组件。
 *
 * 替代散落的 `<Link><ChevronLeft />返回列表</Link>` + `<span>/</span>` + 当前页 inline 实现。
 *
 * 第一项默认带 `<ChevronLeft />` 表示"返回上一级"，其余用 `/` 分隔。
 */

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  /** 右侧可附加小标签 / 副信息（不参与分隔符） */
  trailing?: ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="面包屑"
      className={`flex items-center gap-2 flex-wrap text-sm ${className ?? ""}`}
    >
      {items.map((item, idx) => {
        const last = idx === items.length - 1;
        const first = idx === 0;
        return (
          <span key={idx} className="inline-flex items-center gap-2">
            {idx > 0 && (
              <ChevronRight className="size-3 text-gray-300 shrink-0" />
            )}
            {item.href && !last ? (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
              >
                {first && <ChevronLeft className="size-4" />}
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  last
                    ? "font-medium text-gray-700"
                    : "text-gray-500"
                }
              >
                {item.label}
              </span>
            )}
            {item.trailing && (
              <span className="text-xs text-gray-400 tabular-nums ml-0.5">
                {item.trailing}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
