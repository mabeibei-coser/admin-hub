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
- iron-session cookie `path: "/admin"`（生产 nginx 反代用子路径方案）

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

- 本机：`npm run dev` → http://localhost:3001
- 生产：nginx 子路径 `<domain>/admin/` 反代到 :3001。详见 `README.md` 与 `D:/_workspace/01_项目-Coding/plans/fluttering-juggling-castle.md`（plan 文件 Step 8）

## 工具脚本

- `scripts/init-admin.mjs` —— 生成 admin 密码 bcrypt hash（不直接写 DB）
- `scripts/seed-super-admin.mjs` —— 直接 seed 一个超管到 admins 表
- `scripts/verify-admin-db.ts` —— 检查 admin DB schema 是否正确
- `scripts/smoke-admin.mjs` —— 端到端 smoke 测试（login → list reports → service-tracking）

## 关键约束（不要破坏）

1. **不要在 admin-hub 里写 `nav.*` 表** —— 跨库写事务会触发 `SQLITE_BUSY_SNAPSHOT`，影响 career-nav- 项目
2. **不要把 admin 表 init 加回 career-report 的 db.ts** —— 那是 silent schema drift 的源头
3. **不要把 `data/` 目录放在坚果云/OneDrive 等同步目录** —— sync agent 会破坏 sqlite WAL
4. **iron-session 密钥与 career-report 共用** —— 但不要在 admin-hub 改这个值；任何 cookie 行为变化要同步两个项目

## 与全局规则的关系

继承 `~/.claude/CLAUDE.md`（用户全局偏好）和 `D:\_workspace\01_项目-Coding\CLAUDE.md`（Coding 项目 Karpathy 原则）。
