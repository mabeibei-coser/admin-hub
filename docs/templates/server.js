// ─────────────────────────────────────────────────────────────────────────
// templates/server.js
// 适用：Vite 前端 + Express 后端形态。直接 cp 到项目根作为 `server.js`。
// 替换：把 <PROJECT> 替换成项目名大写（如 SALARY），<your-project> 替换成项目名小写
//      （如 salary-report）。AI 调用部分（FIXME 块）按实际供应商改。
// 来源：基于 salary-report (A500) 实战版本提炼。
// ─────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const { default: express } = await import("express");
const { getSession } = await import("./lib/session.js");
const {
  getDb,
  upsertUserByPhone,
  insertReport,
  findCachedReport,
} = await import("./lib/db.js");

// ──── 配置 ────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4001;
const QUERY_CACHE_MS = 30 * 24 * 60 * 60 * 1000; // 同条件查询 30 天内复用历史结果

// FIXME: 改成你实际的 AI 供应商
const AI_URL = process.env.<PROJECT>_AI_URL || "https://api.example.com/v1/chat/completions";
const AI_API_KEY = process.env.<PROJECT>_API_KEY;
const AI_MODEL = process.env.<PROJECT>_MODEL || "default-model";

const PHONE_RE = /^1\d{10}$/;

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

// ──── 中间件：要求登录 ────────────────────────────────────────────────
function requireSession(handler) {
  return async (req, res) => {
    const session = await getSession(req, res);
    if (!session.userId) return res.status(401).json({ error: "请先登录" });
    req.session = session;
    return handler(req, res);
  };
}

// ──── 路由 1：登录（手机号无 OTP，V1 推荐） ──────────────────────────
app.post("/api/login", async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: "请输入有效的 11 位手机号" });
  }
  try {
    const userId = upsertUserByPhone(phone);
    const session = await getSession(req, res);
    session.userId = userId;
    session.phone = phone;
    session.loggedInAt = Date.now();
    await session.save();
    res.json({ ok: true, userId, phone });
  } catch (err) {
    console.error("[login] failed:", err);
    res.status(500).json({ error: "登录失败，请稍后重试" });
  }
});

// ──── 路由 2：登出 ───────────────────────────────────────────────────
app.post("/api/logout", async (req, res) => {
  const session = await getSession(req, res);
  await session.destroy();
  res.json({ ok: true });
});

// ──── 路由 3：当前用户（前端用于判断是否已登录） ──────────────────
app.get("/api/me", async (req, res) => {
  const session = await getSession(req, res);
  if (!session.userId) return res.status(401).json({ error: "未登录" });
  res.json({ userId: session.userId, phone: session.phone });
});

// ──── 路由 4：业务核心 - 调 AI + 入库 ────────────────────────────────
// formData 字段按你项目实际调整；缓存键 + 入库列名要与 lib/db.js 对齐
app.post(
  "/api/queries",
  requireSession(async (req, res) => {
    const formData = req.body || {};

    // FIXME: 改成你项目的字段校验
    const requiredFields = ["position", "company"]; // 例：薪资查询要的字段
    const missing = requiredFields.filter((k) => !formData[k] || !String(formData[k]).trim());
    if (missing.length) {
      return res.status(400).json({ error: `缺少必填字段：${missing.join(", ")}` });
    }

    // ── 缓存命中：30 天内同条件直接复用历史 ──
    const cached = findCachedReport(formData, QUERY_CACHE_MS);
    if (cached) {
      let cachedReport = null;
      try {
        cachedReport = JSON.parse(cached.report_json);
      } catch {
        // 老记录损坏，落到下面重新调 AI
      }
      if (cachedReport) {
        const reportId = insertReport({
          userId: req.session.userId,
          userPhone: req.session.phone,
          createdAt: Date.now(),
          formData,
          report: cachedReport,
          durationMs: 0,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
        });
        return res.json({ ok: true, reportId, report: cachedReport, durationMs: 0, cached: true });
      }
    }

    // ── 调 AI ──
    if (!AI_API_KEY) {
      return res.status(500).json({ error: "服务器未配置 AI API key" });
    }

    const startedAt = Date.now();
    try {
      // FIXME: 下面整块按你供应商改。下面是 OpenAI 兼容协议的写法。
      const upstream = await fetch(AI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserMessage(formData) },
          ],
          temperature: 0.3,
          max_tokens: 6144,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        console.error("[queries] AI HTTP", upstream.status, text.slice(0, 300));
        return res.status(502).json({ error: `AI 请求失败 (${upstream.status})` });
      }

      const result = await upstream.json();
      const content = result?.choices?.[0]?.message?.content;
      if (!content) return res.status(502).json({ error: "AI 返回内容为空" });

      // 去除 markdown 代码块包裹（常见 AI 输出格式问题）
      let cleaned = String(content).trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      let report;
      try {
        report = JSON.parse(cleaned);
      } catch {
        return res.status(502).json({ error: "AI 返回内容不是有效 JSON" });
      }

      // FIXME: 这里加你项目的字段校验和兜底
      report = validateAndNormalize(report, formData);

      const durationMs = Date.now() - startedAt;
      const reportId = insertReport({
        userId: req.session.userId,
        userPhone: req.session.phone,
        createdAt: Date.now(),
        formData,
        report,
        durationMs,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      });

      res.json({ ok: true, reportId, report, durationMs });
    } catch (err) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        return res.status(504).json({ error: "请求超时（60秒），请稍后重试" });
      }
      console.error("[queries] failed:", err);
      res.status(500).json({ error: "查询失败，请稍后重试" });
    }
  })
);

// ──── 路由 5：取单条报告（用户回看 / 详情页） ─────────────────────────
app.get(
  "/api/reports/:id",
  requireSession(async (req, res) => {
    try {
      const db = getDb();
      const row = db
        .prepare(
          `SELECT id, user_id, user_phone, created_at, report_json, duration_ms
             FROM reports WHERE id = ? AND user_id = ?`
        )
        .get(Number(req.params.id), req.session.userId);
      if (!row) return res.status(404).json({ error: "报告不存在或无权限" });
      res.json({ ok: true, report: JSON.parse(row.report_json), createdAt: row.created_at });
    } catch (err) {
      console.error("[get report] failed:", err);
      res.status(500).json({ error: "查询失败" });
    }
  })
);

// ──── 生产模式：静态托管 dist/ ────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  try {
    getDb(); // 触发建表
    console.log(`[<your-project>] api server on http://localhost:${PORT}`);
  } catch (err) {
    console.error("[<your-project>] DB 初始化失败:", err);
    process.exit(1);
  }
});

// ──── AI prompt & 字段校验（按你业务定制） ────────────────────────────
function buildSystemPrompt() {
  return `你是 <你领域> 的专家。根据用户填表的字段，生成一份 JSON 结构化报告。

输出必须是纯 JSON（不要 markdown 包裹），格式如下：
{
  "title": "...",
  "summary": "...",
  ...
}

请严格遵守 JSON 格式，不要添加任何解释文字。`;
}

function buildUserMessage(formData) {
  // FIXME: 改成你项目的字段
  return `请根据以下信息生成报告：

岗位：${formData.position || ""}
公司：${formData.company || ""}
...
`;
}

function validateAndNormalize(report, formData) {
  // FIXME: 按你 report schema 校验 + 兜底
  // 例：确保数值字段是 number、数组字段是 array、补默认值
  return report;
}
