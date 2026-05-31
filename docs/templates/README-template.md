# <your-project>（<业务一句话描述>）

<2-3 行业务描述：解决什么问题，给谁用，接管自谁>

**业务方**：<谁会用这个>；**接管自**：<原作者>。

## 技术栈

- 前端：Vite + React 18 + <MUI/Tailwind/...> （单页）
- 后端：Node + Express + iron-session + better-sqlite3（`server.js`）
- AI：服务端调 <讯飞 / OpenAI / Claude> `<model-name>`（key 在 server 进程，浏览器 bundle 不含）

## 本地跑

```bash
npm install
cp .env.local.example .env.local   # 填 API key + 生成 session 密钥
npm run dev                        # 同时启 vite(:3000) + express(:4001)
```

> 第一次开服务会自动建 `data/<your-project>.db`。

`.env.local` 关键变量：

```
<PROJECT>_API_KEY=<你的 AI 供应商 API key>
<PROJECT>_MODEL=<model-name>
<PROJECT>_SESSION_PASSWORD=<≥32 字符 base64>
PORT=4001
<PROJECT>_COOKIE_SECURE=false
```

生成 session 密钥：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## 用户流程

1. 打开 `/` 看到登录卡（手机号 + 登录按钮，V1 无验证码）
2. 输入 11 位手机号 → POST `/api/login` → 写 cookie + users 表 upsert
3. 填查询表单 → POST `/api/queries` →
   - 服务端调 AI → JSON 校验 → 写 reports 表 → 返回报告
4. 浏览器渲染 `<YourReport>` 组件

## 主要文件

| 类型 | 路径 | 作用 |
|---|---|---|
| 后端 | `server.js` | Express 入口：login / logout / me / queries |
| 后端 | `lib/db.js` | better-sqlite3 setup + schema + 写库 helper |
| 后端 | `lib/session.js` | iron-session 配置 |
| 前端 | `src/App.jsx` | 顶层壳：登录 gate → 表单 → loading → 报告 |
| 前端 | `src/components/LoginForm.jsx` | 手机号登录卡 |
| 前端 | `src/components/SearchForm.jsx` | 查询参数表单 |
| 前端 | `src/components/<YourReport>.jsx` | 报告聚合渲染 |
| 前端 | `src/services/api.js` | 浏览器 → /api/* 的 fetch 包装 |
| 配置 | `vite.config.js` | dev `/api/*` 反代到 :4001 |
| 配置 | `.env.local.example` | env 模板 |

## 数据库 schema

```sql
-- users 表
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

-- reports 表
CREATE TABLE reports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  user_phone      TEXT    NOT NULL,
  created_at      INTEGER NOT NULL,       -- 毫秒整数
  -- 业务列（按你项目）
  position        TEXT, company TEXT, rank TEXT, education TEXT, city TEXT,
  form_data_json  TEXT,                   -- 用户填表原始
  report_json     TEXT    NOT NULL,       -- AI 返回的完整 JSON
  duration_ms     INTEGER,
  ip              TEXT,
  user_agent      TEXT
);
```

## 部署

待 admin-hub 接管方部署。本项目交付时必须满足
`B100-管理后台-admin-hub/docs/对外接入规范.md` 的 A/B/C/D 4 组全部要求。
