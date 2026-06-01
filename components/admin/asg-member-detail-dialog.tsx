"use client";

/**
 * 安防平台用户 - 会员详情弹窗。
 *
 * - 头部基本信息：会员状态 / VIP 到期 / 累计付款 / 注册日期 / 最后登录 / 成功订单
 * - 充值记录：GET /api/admin/asg-members/[phone] → orders 按 created_at DESC
 * - 仅超管显示「编辑 VIP 到期日 / 撤销 VIP」面板。改动经 PATCH 路由，
 *   asg.memberships UPDATE + asg.membership_ledger(type='admin_adjust') 同事务写入。
 *   详见 admin-hub CLAUDE.md 铁律 #1（已破例授权）。
 */

import { useState, useEffect, useCallback } from "react";
import { X, Crown, RefreshCw, ShieldOff, Save } from "lucide-react";
import { Alert } from "@/components/admin/alert";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/url";

interface OrderRow {
  id: number;
  outTradeNo: string;
  packageId: string;
  amountCents: number;
  durationDays: number;
  status: string;
  createdAt: number;
  paidAt: number | null;
}

interface MemberDetail {
  phone: string;
  isVip: boolean;
  vipExpireAt: number;
  totalPaidCents: number;
  updatedAt: number;
  createdAt: number | null;
  lastLoginAt: number | null;
  orderCount: number;
  paidOrderCount: number;
}

interface DetailResponse {
  member: MemberDetail;
  orders: OrderRow[];
  error?: string;
}

/** YYYY-MM-DD（本地时区），给 <input type="date"> 用 */
function toDateInput(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → 当天 23:59:59.999 的本地毫秒时间戳，方便"到期日当天还能用" */
function dateInputToMs(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return d.getTime();
}

function fmtDate(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateTime(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

const ORDER_STATUS_LABEL: Record<string, { text: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  paid: { text: "已支付", tone: "success" },
  pending: { text: "待支付", tone: "warning" },
  cancelled: { text: "已取消", tone: "neutral" },
  refunded: { text: "已退款", tone: "danger" },
  failed: { text: "失败", tone: "danger" },
};

export function AsgMemberDetailDialog({
  phone,
  isSuper,
  onClose,
  onSaved,
}: {
  phone: string;
  /** 仅超管可看到/使用编辑控件 */
  isSuper: boolean;
  onClose: () => void;
  /** 保存成功后回调（让外层列表刷新） */
  onSaved?: () => void;
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑态（独立于 data，避免每次刷新都覆盖未保存草稿）
  const [draftExpireDate, setDraftExpireDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        withBase(`/api/admin/asg-members/${encodeURIComponent(phone)}`),
        { credentials: "include" }
      );
      const json = (await res.json()) as DetailResponse;
      if (!res.ok) throw new Error(json.error || "加载失败");
      setData(json);
      setDraftExpireDate(toDateInput(json.member.vipExpireAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function patch(vipExpireAt: number, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const res = await fetch(
        withBase(`/api/admin/asg-members/${encodeURIComponent(phone)}`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vipExpireAt }),
        }
      );
      const json = (await res.json()) as { error?: string; ok?: boolean; changed?: boolean };
      if (!res.ok) throw new Error(json.error || "保存失败");
      setSaveMsg(json.changed === false ? "无变化" : "已保存");
      await load();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const ms = dateInputToMs(draftExpireDate);
    if (ms == null) {
      setError("请选择合法的到期日");
      return;
    }
    patch(ms);
  }

  function handleRevoke() {
    patch(0, `确认撤销 ${phone} 的 VIP 资格？此操作会记录到流水。`);
  }

  const hasDraftChange =
    !!data && draftExpireDate !== toDateInput(data.member.vipExpireAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asg-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[var(--amber-50)]">
              <Crown className="size-4 text-[var(--amber-600)]" />
            </div>
            <h2 id="asg-detail-title" className="text-base font-semibold text-foreground">
              会员详情
            </h2>
            <span className="font-mono tabular-nums text-sm text-muted-foreground">{phone}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              disabled={loading}
              title="刷新"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              title="关闭"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {error && <Alert tone="error">{error}</Alert>}

          {/* 基本信息 */}
          {loading && !data ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              加载中…
            </div>
          ) : data ? (
            <>
              <section className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <InfoItem label="会员状态">
                  <StatusPill tone={data.member.isVip ? "success" : "neutral"}>
                    {data.member.isVip ? "VIP" : "普通"}
                  </StatusPill>
                </InfoItem>
                <InfoItem label="VIP 到期">
                  <span className="tabular-nums">
                    {data.member.isVip ? fmtDate(data.member.vipExpireAt) : "—"}
                  </span>
                </InfoItem>
                <InfoItem label="累计付款">
                  <span className="tabular-nums font-medium text-foreground">
                    {yuan(data.member.totalPaidCents)}
                  </span>
                </InfoItem>
                <InfoItem label="注册日期">
                  <span className="tabular-nums">{fmtDate(data.member.createdAt)}</span>
                </InfoItem>
                <InfoItem label="最后登录">
                  <span className="tabular-nums">{fmtDateTime(data.member.lastLoginAt)}</span>
                </InfoItem>
                <InfoItem label="成功订单">
                  <span className="tabular-nums">
                    {data.member.paidOrderCount} / {data.member.orderCount}
                  </span>
                </InfoItem>
              </section>

              {/* 充值记录 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">充值记录</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    共 {data.orders.length} 条
                  </span>
                </div>
                {data.orders.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    暂无订单记录
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">下单时间</th>
                          <th className="px-3 py-2 text-left font-medium">套餐 / 时长</th>
                          <th className="px-3 py-2 text-left font-medium">金额</th>
                          <th className="px-3 py-2 text-left font-medium">状态</th>
                          <th className="px-3 py-2 text-left font-medium">支付时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.orders.map((o) => {
                          const meta = ORDER_STATUS_LABEL[o.status] ?? {
                            text: o.status,
                            tone: "neutral" as const,
                          };
                          return (
                            <tr key={o.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                {fmtDateTime(o.createdAt)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-foreground">{o.packageId}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  {o.durationDays} 天
                                </div>
                              </td>
                              <td className="px-3 py-2 tabular-nums font-medium">
                                {yuan(o.amountCents)}
                              </td>
                              <td className="px-3 py-2">
                                <StatusPill tone={meta.tone}>{meta.text}</StatusPill>
                              </td>
                              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                {fmtDateTime(o.paidAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* 编辑会员状态 / VIP 到期日 — 仅超管 */}
              {isSuper && (
                <section className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-sm font-medium text-foreground">
                      编辑 VIP 到期日
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      改动会写一条 admin_adjust 流水
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={draftExpireDate}
                      onChange={(e) => setDraftExpireDate(e.target.value)}
                      disabled={saving}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || !hasDraftChange || !draftExpireDate}
                    >
                      <Save className="size-3.5" />
                      {saving ? "保存中…" : "保存到期日"}
                    </Button>
                    {data.member.isVip && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevoke}
                        disabled={saving}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        <ShieldOff className="size-3.5" />
                        撤销 VIP
                      </Button>
                    )}
                    {saveMsg && (
                      <span className="text-xs text-[var(--semantic-positive)]">
                        {saveMsg}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                    会员状态 = 「VIP 到期日 &gt; 当前时间」自动派生。把到期日改成今天之前即&ldquo;降为普通&rdquo;；
                    撤销 VIP = 把到期日清零。所有修改在 asg.membership_ledger 留下审计记录。
                  </p>
                </section>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3 sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
