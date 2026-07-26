import type { ProjectCredentialEventInput } from "./service.ts";

const EVENT_KEYS = new Set([
  "bindingId",
  "credentialVersion",
  "status",
  "latencyMs",
  "errorCategory",
]);
const ERROR_CATEGORY = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(header);
  return match?.[1] ?? null;
}

export function parseProjectCredentialEvent(
  body: Record<string, unknown>,
  projectId: string,
): ProjectCredentialEventInput {
  if (Object.keys(body).some((key) => !EVENT_KEYS.has(key))) {
    throw new Error("事件包含未允许的字段");
  }
  const bindingId = body.bindingId;
  const credentialVersion = body.credentialVersion;
  const status = body.status;
  const latencyMs = body.latencyMs;
  const errorCategory = body.errorCategory;

  if (!Number.isSafeInteger(bindingId) || Number(bindingId) <= 0) {
    throw new Error("bindingId 无效");
  }
  if (!Number.isSafeInteger(credentialVersion) || Number(credentialVersion) <= 0) {
    throw new Error("credentialVersion 无效");
  }
  if (status !== "success" && status !== "error") {
    throw new Error("status 无效");
  }
  if (
    !Number.isSafeInteger(latencyMs) ||
    Number(latencyMs) < 0 ||
    Number(latencyMs) > 300_000
  ) {
    throw new Error("latencyMs 无效");
  }
  if (status === "success" && errorCategory != null) {
    throw new Error("成功事件不能包含错误类别");
  }
  if (
    status === "error" &&
    (typeof errorCategory !== "string" || !ERROR_CATEGORY.test(errorCategory))
  ) {
    throw new Error("失败事件必须包含有效错误类别");
  }

  return {
    projectId,
    bindingId: Number(bindingId),
    credentialVersion: Number(credentialVersion),
    status,
    latencyMs: Number(latencyMs),
    errorCategory: status === "error" ? (errorCategory as string) : null,
  };
}
