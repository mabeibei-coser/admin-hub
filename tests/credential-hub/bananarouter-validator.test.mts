import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  testBananaRouterVersion,
  validateBananaRouterCredential,
} from "../../lib/credential-hub/bananarouter-validator.ts";
import { openCredentialDb } from "../../lib/credential-hub/db.ts";
import {
  credentialJson,
  readExactJsonObject,
  validateCredentialMutationRequest,
} from "../../lib/credential-hub/http.ts";
import { A100_PILOT } from "../../lib/credential-hub/pilot.ts";
import {
  activateVersion,
  createCandidate,
  listCredentialAdminViews,
} from "../../lib/credential-hub/service.ts";

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "credential-hub-g03-"));
  const db = openCredentialDb(path.join(dir, "credentials.db"));
  return {
    db,
    key: randomBytes(32),
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function response(status: number, body: string, headers?: HeadersInit): Response {
  return new Response(body, { status, headers });
}

const validPayload = JSON.stringify({
  candidates: [{ content: { parts: [{ text: "OK" }] } }],
});

test("BananaRouter 验证器使用固定 native Gemini 请求且不回传 key", async () => {
  const secret = "validator-secret-never-log";
  let calls = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    assert.equal(
      String(input),
      "https://api.bananarouter.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
    );
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${secret}`);
    return response(200, validPayload, { "Content-Type": "application/json" });
  }) as typeof fetch;

  const result = await validateBananaRouterCredential(
    { endpoint: A100_PILOT.endpoint, model: A100_PILOT.model, apiKey: secret },
    fetchImpl,
  );
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("Authorization"), false);
});

test("BananaRouter 验证器分类 401/403/429/5xx/坏 JSON/空内容", async () => {
  const cases = [
    [401, "{}", "unauthorized"],
    [403, "{}", "unauthorized"],
    [429, "{}", "rate_limited"],
    [500, "{}", "upstream_error"],
    [302, "{}", "upstream_error"],
    [200, "not-json", "invalid_response"],
    [200, JSON.stringify({ candidates: [] }), "invalid_response"],
  ] as const;
  for (const [status, body, category] of cases) {
    const result = await validateBananaRouterCredential(
      { endpoint: A100_PILOT.endpoint, model: A100_PILOT.model, apiKey: "test-key" },
      (async () => response(status, body)) as typeof fetch,
    );
    assert.deepEqual(
      { ok: result.ok, category: result.ok ? null : result.category },
      { ok: false, category },
    );
  }
});

test("BananaRouter 验证器区分超时和网络错误", async () => {
  const timeoutFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
    })) as typeof fetch;
  const timeout = await validateBananaRouterCredential(
    { endpoint: A100_PILOT.endpoint, model: A100_PILOT.model, apiKey: "test-key" },
    timeoutFetch,
    5,
  );
  assert.equal(timeout.ok, false);
  if (!timeout.ok) assert.equal(timeout.category, "timeout");

  const network = await validateBananaRouterCredential(
    { endpoint: A100_PILOT.endpoint, model: A100_PILOT.model, apiKey: "test-key" },
    (async () => {
      throw new Error("network down");
    }) as typeof fetch,
  );
  assert.equal(network.ok, false);
  if (!network.ok) assert.equal(network.category, "network_error");
});

test("错误 key 标记失败且不可启用，正确 key 通过后可启用", async () => {
  const f = fixture();
  const failedSecret = "wrong-key-must-not-appear";
  const validSecret = "valid-key-must-not-appear";
  try {
    const failed = createCandidate(f.db, f.key, {
      ...A100_PILOT,
      secret: failedSecret,
      createdByAdminId: 1,
    });
    const failedResult = await testBananaRouterVersion(
      f.db,
      f.key,
      failed.versionId,
      1,
      (async () => response(401, "{}")) as typeof fetch,
    );
    assert.equal(failedResult.ok, false);
    assert.throws(
      () => activateVersion(f.db, failed.credentialId, failed.versionId),
      /尚未通过验证/,
    );

    const passed = createCandidate(f.db, f.key, {
      ...A100_PILOT,
      secret: validSecret,
      createdByAdminId: 1,
    });
    const passedResult = await testBananaRouterVersion(
      f.db,
      f.key,
      passed.versionId,
      1,
      (async () => response(200, validPayload)) as typeof fetch,
    );
    assert.equal(passedResult.ok, true);
    activateVersion(f.db, passed.credentialId, passed.versionId, 1);

    const serialized = JSON.stringify(listCredentialAdminViews(f.db));
    for (const forbidden of [
      failedSecret,
      validSecret,
      "apiKey",
      "secret_ciphertext",
      "secret_iv",
      "secret_auth_tag",
      "token_hash",
    ]) {
      assert.equal(serialized.includes(forbidden), false, `leaked: ${forbidden}`);
    }
  } finally {
    f.close();
  }
});

test("非试点配置在发出网络请求前被拦截", async () => {
  const f = fixture();
  let calls = 0;
  try {
    const candidate = createCandidate(f.db, f.key, {
      ...A100_PILOT,
      endpoint: "https://evil.example",
      secret: "must-never-be-sent-to-evil",
      createdByAdminId: 1,
    });
    const result = await testBananaRouterVersion(
      f.db,
      f.key,
      candidate.versionId,
      1,
      (async () => {
        calls += 1;
        return response(200, validPayload);
      }) as typeof fetch,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.category, "invalid_configuration");
    assert.equal(calls, 0);
  } finally {
    f.close();
  }
});

test("管理写接口请求校验同源、JSON、字段白名单和 no-store", async () => {
  const valid = new Request("http://admin.local/api/admin/credentials/test", {
    method: "POST",
    headers: {
      Host: "admin.local",
      Origin: "http://admin.local",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey: "safe-test-value" }),
  });
  assert.equal(validateCredentialMutationRequest(valid), null);
  assert.deepEqual(
    await readExactJsonObject(valid, new Set(["apiKey"])),
    { apiKey: "safe-test-value" },
  );

  const crossOrigin = new Request("http://admin.local/api", {
    method: "POST",
    headers: {
      Host: "admin.local",
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.match(validateCredentialMutationRequest(crossOrigin) ?? "", /跨站/);

  const wrongType = new Request("http://admin.local/api", {
    method: "POST",
    headers: { Host: "admin.local", Origin: "http://admin.local", "Content-Type": "text/plain" },
    body: "{}",
  });
  assert.match(validateCredentialMutationRequest(wrongType) ?? "", /JSON/);

  const unknown = new Request("http://admin.local/api", {
    method: "POST",
    headers: {
      Host: "admin.local",
      Origin: "http://admin.local",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey: "safe", endpoint: "https://evil.example" }),
  });
  await assert.rejects(
    () => readExactJsonObject(unknown, new Set(["apiKey"])),
    /未允许的字段/,
  );

  assert.match(credentialJson({ ok: true }).headers.get("cache-control") ?? "", /no-store/);
});
