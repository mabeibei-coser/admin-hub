"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FolderPlus, Pencil, Trash2, Check, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { withBase } from "@/lib/url";

export interface AdminGroupRow {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
  member_count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** 任意变更（新建/重命名/删除）后回调 */
  onChanged: () => void;
}

/**
 * 分组管理弹窗：
 *  - 上：分组名称输入 + 新建按钮
 *  - 下：已创建分组列表（行内重命名 / 删除）
 *
 * 删除时分组成员的 group_id 自动置空（后端事务保证）。
 */
export function AdminGroupDialog({ open, onClose, onChanged }: Props) {
  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 行内重命名状态
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // 删除确认弹窗
  const [confirmDelete, setConfirmDelete] = useState<AdminGroupRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/admin-groups"));
      if (!res.ok) throw new Error((await res.json()).error ?? "加载失败");
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setNewName("");
    setEditingId(null);
    setEditingName("");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchGroups();
  }, [open, fetchGroups]);

  if (!open) return null;

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("请填写分组名称");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/admin-groups"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `新建失败 (HTTP ${res.status})`);
        return;
      }
      setNewName("");
      await fetchGroups();
      onChanged();
    } finally {
      setCreating(false);
    }
  }

  function startRename(g: AdminGroupRow) {
    setEditingId(g.id);
    setEditingName(g.name);
    setError(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveRename(id: number) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError("请填写分组名称");
      return;
    }
    setRenaming(true);
    setError(null);
    try {
      const res = await fetch(withBase(`/api/admin/admin-groups/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `重命名失败 (HTTP ${res.status})`);
        return;
      }
      cancelRename();
      await fetchGroups();
      onChanged();
    } finally {
      setRenaming(false);
    }
  }

  async function confirmDeleteGroup() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        withBase(`/api/admin/admin-groups/${confirmDelete.id}`),
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? `删除失败 (HTTP ${res.status})`);
        setDeleting(false);
        return;
      }
      setConfirmDelete(null);
      setDeleting(false);
      await fetchGroups();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ag-dialog-title"
      >
        <div
          className="fixed inset-0 bg-black/40"
          onClick={creating || renaming ? undefined : onClose}
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-xl shadow-xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-[var(--blue-50)]">
                <FolderTree className="size-4 text-[var(--blue-700)]" />
              </div>
              <h2
                id="ag-dialog-title"
                className="text-base font-semibold text-foreground"
              >
                管理分组
              </h2>
            </div>
            <button
              onClick={onClose}
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 新建分组 */}
          <div className="space-y-1.5 mb-4">
            <Label htmlFor="ag-new-name">分组名称</Label>
            <div className="flex gap-2">
              <Input
                id="ag-new-name"
                placeholder="如：职业导航组"
                value={newName}
                maxLength={30}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                style={{ fontSize: "16px" }}
              />
              <Button
                type="button"
                className="btn-primary-glow text-white shrink-0"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                <FolderPlus className="size-3.5" />
                {creating ? "创建中…" : "创建"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-[var(--semantic-danger)] bg-[oklch(0.97_0.04_25)] dark:bg-[oklch(0.3_0.08_25)] rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}

          {/* 已创建分组列表 */}
          <div className="space-y-1.5">
            <Label>已创建分组</Label>
            <div className="rounded-lg border border-border max-h-72 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-7 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  还没有分组，使用上方输入框创建第一个
                </div>
              ) : (
                <ul className="divide-y divide-[var(--report-divider)]">
                  {groups.map((g) => {
                    const isEditing = editingId === g.id;
                    return (
                      <li
                        key={g.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                      >
                        {isEditing ? (
                          <>
                            <Input
                              value={editingName}
                              maxLength={30}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveRename(g.id);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelRename();
                                }
                              }}
                              autoFocus
                              className="h-7 text-sm"
                              style={{ fontSize: "16px" }}
                            />
                            <button
                              type="button"
                              onClick={() => saveRename(g.id)}
                              disabled={renaming}
                              title="保存"
                              className="size-7 flex items-center justify-center rounded-md text-[var(--semantic-positive)] hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelRename}
                              disabled={renaming}
                              title="取消"
                              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              <X className="size-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-foreground truncate">
                              {g.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {g.member_count} 人
                            </span>
                            <button
                              type="button"
                              onClick={() => startRename(g)}
                              title="重命名"
                              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-[var(--blue-700)] hover:bg-muted transition-colors"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(g)}
                              title="删除"
                              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-[var(--semantic-danger)] hover:bg-muted transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          icon={Trash2}
          tone="danger"
          title="删除分组"
          confirmLabel="删除"
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={confirmDeleteGroup}
        >
          <p>
            确定删除分组「<span className="font-medium">{confirmDelete.name}</span>」？
          </p>
          {confirmDelete.member_count > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              该分组下的 {confirmDelete.member_count} 位管理员会变成「未分组」，不会被删除。
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
