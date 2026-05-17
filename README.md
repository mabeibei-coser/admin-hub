# admin-hub

跨业务管理后台。当前管两个业务的数据：
- **职业定位**（career-report 项目）—— 用户端 `localhost:3000`
- **职业导航**（career-nav- 项目）—— 用户端独立

admin-hub 本身只跑 admin UI + API（`localhost:3001`），不直接服务终端用户。

---

## 与上游项目的关系图

```
┌─────────────────────┐         ┌─────────────────────┐
│  career-report      │         │  career-nav-        │
│  (职业定位用户端)   │         │  (职业导航用户端)   │
│  :3000              │         │  :????              │
│                     │         │                     │
│  data/              │         │  data/              │
│   ↳ career-report.db│◀───┐  ┌▶│   ↳ career-nav.db   │
└─────────────────────┘    │  │ └─────────────────────┘
                           │  │
                  DB_PATH  │  │  NAV_DB_PATH
                           │  │
                       ┌───┴──┴──────────┐
                       │  admin-hub      │
                       │  :3001 / :3004  │  (本机 / 生产)
                       │  /b100/         │
                       └─────────────────┘
```

- admin-hub 通过 env 配置的**绝对路径**指向两个业务的 sqlite 文件
- admin-hub 对 `main.*`（career-report.db 内的 admins / service_tracking / service_tracking_records）全写
- admin-hub 对 `nav.*`（career-nav.db 内的 reports）**只读**（避免跨库写事务触发 `SQLITE_BUSY_SNAPSHOT`）
- schema 单一拥有者：admin-hub 独家拥有 `admins / service_tracking / service_tracking_records` 三张表的 init 代码

---

## 本机启动

1. 装依赖：
   ```powershell
   npm install
   ```

2. 配置 env（复制模板）：
   ```powershell
   copy .env.local.example .env.local
   # 然后填值，ADMIN_SESSION_PASSWORD 必须和 career-report 完全一致
   ```

3. 启动：
   ```powershell
   npm run dev
   # 打开 http://localhost:3001/b100/admin/login
   ```

4. （可选）跑 smoke 测试验证全链路：
   ```powershell
   $env:BASE_URL="http://localhost:3001"
   $env:ADMIN_USERNAME="<手机号>"
   $env:ADMIN_PASSWORD="<明文密码>"
   npm run smoke
   ```

---

## ⚠️ 关键运行约束

### data/ 目录不得放在云同步目录下

`data/` 里的 sqlite 文件（`career-report.db`、`career-nav.db`）以及 WAL 模式产生的 `.db-wal` 和 `.db-shm`，**绝不可以**落到坚果云 / OneDrive / Dropbox 等云盘同步目录里。同步代理会持文件锁，破坏 WAL 一致性。

部署到腾讯云 Lighthouse 时，data/ 走绝对路径，落在 `/var/lib/...` 一类的本地盘目录。本机开发就放在 `D:/_workspace/01_项目-Coding/{career-report|career-nav-}/data/` 即可（这两个目录不在坚果云里）。

### admin-hub 对 nav.* 只读

任何对 `nav.reports` 的 SQL **必须是 SELECT**。如果未来要在 admin 里"标记 nav 报告为已处理"之类的写操作，必须：
- 要么在 main.* 表里加一张映射表
- 要么走 HTTP 调 career-nav- 的 API 让它自己写

不要在 admin-hub 里写 `UPDATE nav.reports`，会与 career-nav- 自己的写入抢锁。

### Schema 拥有权

`admins / service_tracking / service_tracking_records` 三张表的 `CREATE TABLE IF NOT EXISTS` 只能存在于 admin-hub 的 `lib/db.ts`。career-report 切走 admin 后已删除这些 init 代码块——如果发现 career-report 又把这些表 init 加回来，立即移除。

### 不并行跑两个 admin

career-report 切走 admin 后，它的 `app/admin/` 已被改名（或删除）。不要尝试在 career-report 里恢复 admin 路由——iron-session cookie 是 host-scoped，两个进程同时活会有 session 双源问题。

---

## 共享代码

下列文件在 admin-hub 和 career-report **各保留一份**，文件头有 `// SHARED:` 注释提醒：
- `lib/projects.ts`
- `lib/phone.ts`
- `components/ui/*`（shadcn 基础组件）

改一边记得改另一边。如果以后这种漂移变得高频（每月超过 2 次），再考虑 monorepo 提共享包。

---

## 文件结构

```
admin-hub/
├── app/
│   ├── admin/              # 登录页 + 后台页面（11 个）
│   ├── api/admin/          # 后台 API（15 个 route）
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── admin/              # admin 专用组件
│   ├── report/             # 报告渲染（复用 career-report 的 6 章节 + nav 5 模块）
│   └── ui/                 # shadcn 基础组件
├── lib/
│   ├── db.ts               # SQLite 连接 + admin 表 init + ATTACH nav.db
│   ├── admin-session.ts    # iron-session，cookieOptions.path:"/b100"
│   ├── menus.ts            # 菜单权限
│   ├── service-tracking.ts # 服务跟进枚举/权限
│   ├── projects.ts         # SHARED
│   ├── phone.ts            # SHARED
│   ├── pdf-export.ts       # PDF 导出
│   ├── text-normalize.ts
│   ├── types.ts            # career-report 业务类型
│   ├── types-nav.ts        # career-nav 业务类型
│   └── utils.ts            # cn() 等
├── proxy.ts                # Next.js 16 中间件：admin 鉴权 + 超管闸门
├── scripts/
│   └── smoke-admin.mjs     # 端到端 smoke 脚本
├── .env.local.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 部署

生产环境通过 nginx 把 `/b100/` 子路径反代到 admin-hub `:3004`（端口由 PM2 + nginx 配合自动分配）。详见根目录 skill `tencent-deploy` 或日常说"部署"即触发。

部署架构：
- `h100.jsai100.com/b100/...` → nginx → `127.0.0.1:3004/b100/...` → admin-hub
- `h100.jsai100.com/`         → nginx → `127.0.0.1:3000` → career-report（用户端）

回滚预案：
1. nginx 注释掉 `/b100/` location，`nginx -s reload`
2. pm2 停掉 admin-hub：`pm2 stop admin-hub`
3. 完全撤回切割：在 career-report 仓 git revert `c1f4b17`（"切走管理后台"那个 commit）后重新部署 career-report
