# admin-hub

跨业务管理后台。从 career-report 切出来的，2026-05-17 完成切分。

## 项目定位

- **是什么**：管理后台 + 服务跟进 + 跨业务报告聚合视图
- **跨哪些业务**：当前管 `career-report`（职业定位）和 `career-nav-`（职业导航）。未来还可加更多业务，加法是 `lib/projects.ts` 加一项 + db.ts 加 ATTACH 一个新业务的 sqlite
- **不是什么**：不直接服务终端用户。终端用户走对应业务的前台（career-report :3000、career-nav- :????）

## 技术栈

- Next.js 16 + TypeScript + Tailwind CSS v4 + shadcn/ui（@base-ui/react）
- better-sqlite3（WAL 模式）+ iron-session + bcryptjs
- proxy.ts（Next.js 16 中间件，鉴权 + 超管闸门）

## 项目结构

详见 `README.md`。关键约束：
- admin-hub 对 `nav.*` 只读
- admin-hub 独家拥有 `admins / service_tracking / service_tracking_records` 三张表的 schema
- iron-session cookie `path: "/b100"`（与 next.config.ts 的 basePath 严格相等；生产 nginx 子路径方案）

## 数据访问

- `DB_PATH` env → career-report 项目的 sqlite 文件（绝对路径）
- `NAV_DB_PATH` env → career-nav- 项目的 sqlite 文件（绝对路径）
- 这两个 env 必填，没默认值能保证正确性
- 本机 `.env.local` 已配置；生产 `.env` 由部署时手动写

## 共享代码（与 career-report）

`lib/projects.ts`、`lib/phone.ts` 在两个项目里各一份，文件头有 `// SHARED` 注释。改一边记得改另一边。
shadcn 的 `components/ui/` 也各一份。

如果以后这种漂移变得高频（每月 >2 次），再考虑 monorepo 提共享包。

## 部署

- 本机：`npm run dev` → `http://localhost:3001/b100/admin/login`
- 生产：nginx 子路径 `https://h100.jsai100.com/b100/` 反代到服务器 :3004。日常说"部署"即触发 `tencent-deploy` skill，自动跑 merge main + push tag + ssh git pull + pm2 restart + curl 验证

## 工具脚本

- `scripts/init-admin.mjs` —— 生成 admin 密码 bcrypt hash（不直接写 DB）
- `scripts/seed-super-admin.mjs` —— 直接 seed 一个超管到 admins 表
- `scripts/verify-admin-db.ts` —— 检查 admin DB schema 是否正确
- `scripts/smoke-admin.mjs` —— 端到端 smoke 测试（login → list reports → service-tracking）

## 关键约束（不要破坏）

1. **跨库写白名单** —— admin-hub 默认对所有 ATTACH 进来的项目库（`nav.*` / `startup.*` / `tailor.*` / `salary.*` / `hazard.*` / `interview.*` / `teaching.*` / `asg.*` / `ata.*`）**只读**。跨库写事务可能触发 `SQLITE_BUSY_SNAPSHOT`，影响目标项目。**已授权的写操作仅以下两处，其余一律严格只读**：
   - **(A) 调整 asg VIP 到期**（2026-06-01）：
     - `UPDATE asg.memberships SET vip_expire_at, updated_at WHERE phone = ?`（超管手动调整 VIP 到期）
     - `INSERT INTO asg.membership_ledger (..., type='admin_adjust', ...)`（同事务追加审计流水）
     - 入口：`PATCH /api/admin/asg-members/[phone]` + `requireSuper()` 闸门
   - **(B) 写 ata 法律文档**（2026-06-11）：
     - `INSERT/UPDATE ata.site_settings`（key=`legal_terms`/`legal_privacy` 的服务协议/隐私政策正文 upsert；含防御性 `CREATE TABLE IF NOT EXISTS ata.site_settings`，与 ata100/lib/db.js 同一份 DDL）
     - 入口：`PUT /api/admin/site-settings` +「系统设置」页 + `requireSuper()` 闸门
     - 联动：薪酬登录页勾选项 + ata100 公开接口 `GET /api/legal/:type` 只读它
   - 风险缓解（两处共用）：`db.transaction()` 原子 + `busy_timeout=5000ms`；目标项目只读自己的库，写竞争窗口很小（site_settings 写极罕见、ata100 自身从不写它，竞争≈0）
2. **不要把 admin 表 init 加回 career-report 的 db.ts** —— 那是 silent schema drift 的源头
3. **不要把 `data/` 目录放在坚果云/OneDrive 等同步目录** —— sync agent 会破坏 sqlite WAL
4. **iron-session 密钥与 career-report 共用** —— 但不要在 admin-hub 改这个值；任何 cookie 行为变化要同步两个项目
5. **客户端 URL 必须用 `lib/url.ts` 的 `withBase()` 包装** —— Next.js 的 basePath 不会自动作用到 `fetch()` / `window.location.href` / `window.open` / 原生 `<a href>` / proxy.ts 里 `new URL(path, req.url)`。`<Link>` / `router.push` / `next/navigation` 的 `redirect()` 会自动加 basePath，不用包。漏了 withBase 会让客户端请求剥离 `/b100`，详见 commit `3256262`

## 历史踩坑 / 早期警报

完整复盘见 `.planning/postmortems/2026-05-17-basepath-leak.md`（搬家比喻 + 时间线 + 7 条避免清单）。

**这个项目下次再碰到这 5 种情况，必须立刻停下：**

1. **改了 basePath / 路由前缀 / cookie path 这类全局配置** → 别只看代码 / curl，**打开浏览器 DevTools Network，确认一个 fetch 调用的真实 URL 带前缀**。今天的 5 小时坑就是因为这一步没做。
2. **修同一个问题改了 2 次还没好** → 不要继续试，走 `/investigate` 系统化找根因。"再试一个"是反 pattern。
3. **新路径能用 + 老路径也能用** → 这往往是兜底掩盖 bug，不是兼容。**新通 + 老 404 才算切干净**。
4. **凌晨做架构改动** → 疲劳决策，第二天准翻车，留到第二天早上做。
5. **同一天想做 ≥ 2 件大事**（架构切割 / 全局配置 / 上生产）→ 拆开做，每件吃一天。

## 与全局规则的关系

继承 `~/.claude/CLAUDE.md`（用户全局偏好）和 `D:\_workspace\01_项目-Coding\CLAUDE.md`（Coding 项目 Karpathy 原则）。
