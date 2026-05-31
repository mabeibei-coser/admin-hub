"use client";

import { useState, useEffect } from "react";
import { X, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidCnMobile } from "@/lib/phone";
import { withBase } from "@/lib/url";
import type { CoursewareUserRow } from "@/lib/courseware-users";

interface Props {
  open: boolean;
  /** null = 新建；有值 = 编辑 */
  editing: CoursewareUserRow | null;
  onClose: () => void;
  /** 保存成功后回调（列表刷新） */
  onSaved: () => void;
}

/**
 * 课件用户 新建 / 编辑 弹窗。
 * 新建：手机号 + 姓名 + 备注 + 其他备注（status 默认 active）。
 * 编辑：手机号只读，可改 姓名 / 状态 / 备注 / 其他备注。
 */
export function CoursewareUserDialog({ open, editing, onClose, onSaved }: Props) {
  const isEdit = !!editing;
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [note2, setNote2] = useState("");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // 每次打开按 editing 重置表单
    /* eslint-disable react-hooks/set-state-in-effect */
    setError(null);
    setSubmitting(false);
    setPhone(editing?.phone ?? "");
    setName(editing?.name ?? "");
    setNote(editing?.note ?? "");
    setNote2(editing?.note2 ?? "");
    setStatus(editing?.status ?? "active");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, editing]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    if (!isEdit && !isValidCnMobile(trimmedPhone)) {
      setError("请输入有效的 11 位手机号");
      return;
    }
    if (!trimmedName) {
      setError("请填写姓名");
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? withBase(`/api/admin/courseware-users/${editing!.id}`)
        : withBase("/api/admin/courseware-users");
      const method = isEdit ? "PATCH" : "POST";
      const payload = isEdit
        ? { name: trimmedName, note: note.trim(), note2: note2.trim(), status }
        : { phone: trimmedPhone, name: trimmedName, note: note.trim(), note2: note2.trim() };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `操作失败 (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(`提交失败：${err instanceof Error ? err.message : "网络错误"}`);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cu-dialog-title"
    >
      <div
        className="fixed inset-0 bg-black/40"
        onClick={submitting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm bg-card text-card-foreground border border-border rounded-xl shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[var(--blue-50)]">
              <GraduationCap className="size-4 text-[var(--blue-700)]" />
            </div>
            <h2 id="cu-dialog-title" className="text-base font-semibold text-foreground">
              {isEdit ? "编辑课件用户" : "添加课件用户"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 手机号 */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-phone">手机号</Label>
            {isEdit ? (
              <Input
                id="cu-phone"
                value={phone}
                readOnly
                disabled
                className="bg-muted text-muted-foreground"
                style={{ fontSize: "16px" }}
              />
            ) : (
              <Input
                id="cu-phone"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder="11 位手机号，用于登录智能课件"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ fontSize: "16px" }}
              />
            )}
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                手机号不可修改，如需换号请删除后重新添加。
              </p>
            )}
          </div>

          {/* 姓名 */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-name">姓名</Label>
            <Input
              id="cu-name"
              placeholder="如：张老师"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* 状态（仅编辑时可改；新建默认启用） */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label>状态</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border transition-all ${
                    status === "active"
                      ? "ring-2 ring-[var(--semantic-positive)] bg-[oklch(0.96_0.04_155)] dark:bg-[oklch(0.3_0.08_155)] text-[var(--semantic-positive)] border-transparent"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  启用
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("disabled")}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border transition-all ${
                    status === "disabled"
                      ? "ring-2 ring-[var(--semantic-warning)] bg-[oklch(0.97_0.06_70)] dark:bg-[oklch(0.3_0.08_65)] text-[var(--semantic-warning)] border-transparent"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  停用
                </button>
              </div>
              {status === "disabled" && (
                <p className="text-[11px] text-[var(--semantic-warning)]">
                  停用后该手机号将无法登录智能课件。
                </p>
              )}
            </div>
          )}

          {/* 备注 */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-note">备注（选填）</Label>
            <Input
              id="cu-note"
              placeholder="如：所属学校 / 年级"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* 其他备注 */}
          <div className="space-y-1.5">
            <Label htmlFor="cu-note2">其他备注（选填）</Label>
            <Textarea
              id="cu-note2"
              rows={2}
              placeholder="补充信息"
              value={note2}
              onChange={(e) => setNote2(e.target.value)}
              className="resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--semantic-danger)] bg-[oklch(0.97_0.04_25)] dark:bg-[oklch(0.3_0.08_25)] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1 btn-primary-glow text-white"
              disabled={submitting}
            >
              {submitting ? "保存中…" : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
