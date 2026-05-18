import { Button } from "@/components/ui/button";

/**
 * Pagination — 后台列表统一分页组件。
 *
 * 支持桌面/移动两种排布：
 *   - 桌面：左侧显示总数，右侧上/下页 + 当前页/总页数
 *   - 移动 (compact)：上/下页按钮 + 中间页码
 */

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  compact = false,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-t border-[var(--report-border)] ${className ?? ""}`}
    >
      {!compact && typeof total === "number" ? (
        <div className="text-xs text-gray-500 tabular-nums">
          共 <span className="font-medium text-gray-700">{total}</span> 条
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2.5 hover:bg-[var(--blue-50)]/40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <div className="px-2 text-xs text-gray-600 tabular-nums whitespace-nowrap">
          <span className="font-semibold text-gray-900">{page}</span>
          <span className="text-gray-300 mx-1">/</span>
          <span>{totalPages}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2.5 hover:bg-[var(--blue-50)]/40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
