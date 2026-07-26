"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  FlaskConical,
  KeyRound,
  Link2,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { Alert } from "@/components/admin/alert";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill, type StatusTone } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withBase } from "@/lib/url";

interface PilotInfo {
  logicalKey: string;
  projectId: string;
  provider: string;
  capability: string;
  role: "primary";
  endpoint: string;
  model: string;
  protocol: string;
}

interface CredentialVersionView {
  id: number;
  version: number;
  status: "candidate" | "active" | "retired" | "revoked";
  testStatus: "untested" | "passed" | "failed";
  testErrorCategory: string | null;
  endpoint: string;
  model: string;
  protocol: string;
  testedAt: number | null;
  activatedAt: number | null;
}

interface CredentialView {
  id: number;
  logicalKey: string;
  provider: string;
  capability: string;
  bindings: Array<{
    id: number;
    projectId: string;
    capability: string;
    role: "primary" | "fallback";
  }>;
  versions: CredentialVersionView[];
}

interface CredentialData {
  pilot: PilotInfo;
  credentials: CredentialView[];
  events: Array<{
    id: number;
    projectId: string;
    bindingId: number;
    credentialVersion: number;
    status: "success" | "error";
    latencyMs: number;
    errorCategory: string | null;
    createdAt: number;
  }>;
}

type ConfirmState =
  | { kind: "activate"; versionId: number; version: number }
  | { kind: "rollback" }
  | null;

const CATEGORY_LABEL: Record<string, string> = {
  unauthorized: "Key 未授权或已失效",
  rate_limited: "供应商限流，请稍后重试",
  timeout: "供应商连接超时",
  upstream_error: "供应商服务异常",
  invalid_response: "供应商返回格式异常",
  network_error: "网络连接失败",
  invalid_configuration: "固定模型配置不匹配",
};

const STATUS_LABEL: Record<CredentialVersionView["status"], string> = {
  candidate: "候选",
  active: "生效中",
  retired: "旧版本",
  revoked: "已撤销",
};

function statusTone(status: CredentialVersionView["status"]): StatusTone {
  if (status === "active") return "success";
  if (status === "candidate") return "info";
  if (status === "revoked") return "danger";
  return "neutral";
}

function formatTime(value: number | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "操作失败");
  }
  return body;
}

export function CredentialCenter() {
  const [data, setData] = useState<CredentialData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(withBase("/api/admin/credentials"), {
        credentials: "include",
        cache: "no-store",
      });
      setData((await readResponse(response)) as unknown as CredentialData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 初次进入页面加载只读元数据。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const credential = useMemo(
    () => data?.credentials.find((item) => item.logicalKey === data.pilot.logicalKey),
    [data],
  );
  const canRollback = Boolean(
    credential?.versions.some((version) => version.status === "active") &&
      credential?.versions.some(
        (version) => version.status === "retired" && version.testStatus === "passed",
      ),
  );

  const post = useCallback(async (path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(withBase(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return readResponse(response);
  }, []);

  async function createVersion() {
    if (!data || apiKey.trim().length < 16) return;
    setBusy("create");
    setError(null);
    setNotice(null);
    try {
      await post(
        `/api/admin/credentials/${encodeURIComponent(data.pilot.logicalKey)}/versions`,
        { apiKey },
      );
      setNotice("候选版本已加密保存，必须先通过验证才能启用。");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "创建失败");
    } finally {
      setApiKey("");
      setBusy(null);
    }
  }

  async function testVersion(versionId: number) {
    setBusy(`test:${versionId}`);
    setError(null);
    setNotice(null);
    try {
      const result = await post(
        `/api/admin/credentials/versions/${versionId}/test`,
      );
      if (result.ok === true) {
        setNotice("真实最小请求已通过，这个候选版本现在可以启用。");
      } else {
        const category = typeof result.category === "string" ? result.category : "unknown";
        setError(CATEGORY_LABEL[category] ?? "凭证验证未通过");
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "验证失败");
    } finally {
      setBusy(null);
    }
  }

  async function runConfirmedAction() {
    if (!data || !confirm) return;
    const action = confirm;
    setBusy(action.kind);
    setError(null);
    setNotice(null);
    try {
      if (action.kind === "activate") {
        await post(`/api/admin/credentials/versions/${action.versionId}/activate`);
        setNotice(`版本 v${action.version} 已启用。候选切换为原子操作。`);
      } else {
        await post(
          `/api/admin/credentials/${encodeURIComponent(data.pilot.logicalKey)}/rollback`,
        );
        setNotice("已安全回滚到上一个验证通过的版本。");
      }
      setConfirm(null);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        icon={KeyRound}
        title="凭证中心"
        eyebrow="A100 单项目试点"
        subtitle="在后台验证并切换 BananaRouter 凭证；业务项目不再需要人工改业务 Key。"
        accentColor="indigo"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading || busy !== null}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        }
      />

      <Alert tone="info" title="本轮只验证一条最小链路">
        B100 管理后台 → A100 简历文字能力 → BananaRouter。总钥匙和项目取件 token
        仍只放服务器环境，不会出现在本页面。
      </Alert>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-[var(--indigo-50)] text-[var(--indigo-700)] ring-1 ring-[var(--indigo-200)]/60 flex items-center justify-center">
              <Link2 className="size-4.5" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--navy-900)]">A100 简历优化 · 文字主线路</h2>
              <p className="text-xs text-muted-foreground mt-1">
                A100 / resume_text / primary
              </p>
            </div>
          </div>
          <StatusPill tone={credential?.versions.some((v) => v.status === "active") ? "success" : "warning"}>
            {credential?.versions.some((v) => v.status === "active") ? "已有生效版本" : "尚未启用"}
          </StatusPill>
        </div>

        {data && (
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <ConfigCell label="供应商 / 协议" value={`${data.pilot.provider} · ${data.pilot.protocol}`} />
            <ConfigCell label="模型" value={data.pilot.model} />
            <ConfigCell label="固定端点" value={data.pilot.endpoint} />
          </div>
        )}
      </section>

      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-[var(--blue-50)] text-[var(--blue-700)] ring-1 ring-[var(--blue-200)]/60 flex items-center justify-center">
            <Plus className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--navy-900)]">新增候选版本</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              保存后输入框立即清空；候选不会影响当前生效版本。
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="credential-api-key" className="block text-xs text-muted-foreground mb-1.5">
              BananaRouter API Key
            </label>
            <Input
              id="credential-api-key"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="仅在这里粘贴，不会回显"
              disabled={busy !== null}
            />
          </div>
          <Button
            className="sm:self-end"
            onClick={createVersion}
            disabled={!data || apiKey.trim().length < 16 || busy !== null}
          >
            <ShieldCheck className="size-3.5" />
            {busy === "create" ? "加密保存中…" : "保存为候选"}
          </Button>
        </div>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-[var(--blue-700)]" />
            <h2 className="font-semibold text-[var(--navy-900)]">版本记录</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirm({ kind: "rollback" })}
            disabled={!canRollback || busy !== null}
          >
            <RotateCcw className="size-3.5" /> 回滚
          </Button>
        </div>

        {loading ? (
          <div className="py-14 text-center text-sm text-muted-foreground">加载中…</div>
        ) : !credential || credential.versions.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">
            尚无版本，请先保存一个候选 Key。
          </div>
        ) : (
          <div className="divide-y divide-border">
            {credential.versions.map((version) => {
              const canTest = version.status === "candidate" || version.status === "retired";
              const canActivate =
                version.testStatus === "passed" &&
                (version.status === "candidate" || version.status === "retired");
              return (
                <div key={version.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">v{version.version}</span>
                      <StatusPill tone={statusTone(version.status)}>{STATUS_LABEL[version.status]}</StatusPill>
                      <StatusPill
                        tone={
                          version.testStatus === "passed"
                            ? "success"
                            : version.testStatus === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {version.testStatus === "passed"
                          ? "验证通过"
                          : version.testStatus === "failed"
                            ? "验证失败"
                            : "待验证"}
                      </StatusPill>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
                      <span>Key：••••••••（已加密保存）</span>
                      <span>测试：{formatTime(version.testedAt)}</span>
                      <span>启用：{formatTime(version.activatedAt)}</span>
                    </div>
                    {version.testErrorCategory && (
                      <p className="text-xs text-[var(--semantic-danger)]">
                        {CATEGORY_LABEL[version.testErrorCategory] ?? "验证未通过"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canTest && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testVersion(version.id)}
                        disabled={busy !== null}
                      >
                        <FlaskConical className="size-3.5" />
                        {busy === `test:${version.id}` ? "验证中…" : "真实验证"}
                      </Button>
                    )}
                    {version.status !== "active" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setConfirm({ kind: "activate", versionId: version.id, version: version.version })
                        }
                        disabled={!canActivate || busy !== null}
                      >
                        <Power className="size-3.5" /> 启用
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Link2 className="size-4 text-[var(--blue-700)]" />
          <h2 className="font-semibold text-[var(--navy-900)]">A100 最近使用状态</h2>
        </div>
        {!data || data.events.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            A100 接入后，这里会显示最近使用的凭证版本和结果。
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.events.map((event) => (
              <div key={event.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="font-medium">{event.projectId}</span>
                <span className="tabular-nums text-muted-foreground">v{event.credentialVersion}</span>
                <StatusPill tone={event.status === "success" ? "success" : "danger"}>
                  {event.status === "success" ? "调用成功" : "调用失败"}
                </StatusPill>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {event.latencyMs} ms · {formatTime(event.createdAt)}
                </span>
                {event.errorCategory && (
                  <span className="text-xs text-[var(--semantic-danger)]">
                    {event.errorCategory}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {confirm?.kind === "activate" && (
        <ConfirmDialog
          icon={Power}
          tone="warning"
          title="启用候选版本"
          confirmLabel="确认启用"
          busy={busy === "activate"}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirmedAction}
        >
          启用 v{confirm.version} 后，当前版本会原子切换为旧版。A100 接入客户端后将在
          60 秒内读取新版本。
        </ConfirmDialog>
      )}
      {confirm?.kind === "rollback" && (
        <ConfirmDialog
          icon={RotateCcw}
          tone="warning"
          title="回滚凭证版本"
          confirmLabel="确认回滚"
          busy={busy === "rollback"}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirmedAction}
        >
          将恢复到最近一个验证通过的旧版本，整个切换在同一事务内完成。
        </ConfirmDialog>
      )}
    </div>
  );
}

function ConfigCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3.5 py-3 min-w-0">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground break-all">{value}</div>
    </div>
  );
}
