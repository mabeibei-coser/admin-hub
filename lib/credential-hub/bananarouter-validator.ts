import type Database from "better-sqlite3";

import { isA100PilotConfiguration } from "./pilot.ts";
import {
  getCredentialVersionForValidation,
  markVersionTestResult,
} from "./service.ts";

export type BananaRouterValidationCategory =
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "upstream_error"
  | "invalid_response"
  | "network_error"
  | "invalid_configuration";

export type BananaRouterValidationResult =
  | { ok: true; latencyMs: number }
  | { ok: false; category: BananaRouterValidationCategory; latencyMs: number };

interface BananaRouterValidationInput {
  endpoint: string;
  model: string;
  apiKey: string;
}

const MAX_RESPONSE_BYTES = 64 * 1024;
const inFlightVersions = new Set<number>();

function hasCandidateText(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return false;
  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") return false;
    const parts = (content as { parts?: unknown }).parts;
    return (
      Array.isArray(parts) &&
      parts.some(
        (part) =>
          part &&
          typeof part === "object" &&
          typeof (part as { text?: unknown }).text === "string" &&
          Boolean((part as { text: string }).text.trim()),
      )
    );
  });
}

export async function validateBananaRouterCredential(
  input: BananaRouterValidationInput,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<BananaRouterValidationResult> {
  const startedAt = Date.now();
  const done = (
    result:
      | { ok: true }
      | { ok: false; category: BananaRouterValidationCategory },
  ): BananaRouterValidationResult => ({ ...result, latencyMs: Date.now() - startedAt });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${input.endpoint}/v1beta/models/${encodeURIComponent(input.model)}:generateContent`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "这是凭证连通性测试。" }] },
        contents: [{ role: "user", parts: [{ text: "只回复 OK" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      return done({ ok: false, category: "unauthorized" });
    }
    if (response.status === 429) {
      return done({ ok: false, category: "rate_limited" });
    }
    if (!response.ok) {
      return done({ ok: false, category: "upstream_error" });
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      return done({ ok: false, category: "invalid_response" });
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
      return done({ ok: false, category: "invalid_response" });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return done({ ok: false, category: "invalid_response" });
    }
    return hasCandidateText(payload)
      ? done({ ok: true })
      : done({ ok: false, category: "invalid_response" });
  } catch {
    return controller.signal.aborted
      ? done({ ok: false, category: "timeout" })
      : done({ ok: false, category: "network_error" });
  } finally {
    clearTimeout(timer);
  }
}

export async function testBananaRouterVersion(
  db: Database.Database,
  masterKey: Buffer,
  versionId: number,
  actorAdminId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<BananaRouterValidationResult> {
  if (inFlightVersions.has(versionId)) throw new Error("该凭证版本正在验证");
  inFlightVersions.add(versionId);
  try {
    const version = getCredentialVersionForValidation(db, versionId, masterKey);
    if (!isA100PilotConfiguration(version)) {
      const result: BananaRouterValidationResult = {
        ok: false,
        category: "invalid_configuration",
        latencyMs: 0,
      };
      markVersionTestResult(
        db,
        versionId,
        false,
        result.category,
        actorAdminId,
      );
      return result;
    }
    const result = await validateBananaRouterCredential(
      {
        endpoint: version.endpoint,
        model: version.model,
        apiKey: version.apiKey,
      },
      fetchImpl,
    );
    markVersionTestResult(
      db,
      versionId,
      result.ok,
      result.ok ? null : result.category,
      actorAdminId,
    );
    return result;
  } finally {
    inFlightVersions.delete(versionId);
  }
}
