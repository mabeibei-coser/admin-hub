#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# admin-hub 接入自检脚本 v1
# 用法：cp 到项目根 scripts/self-check.sh，跑 bash scripts/self-check.sh
# 全 OK 才算满足接入规范；任意 MISS / BAD 必须修复后才能交付。
# ─────────────────────────────────────────────────────────────────────────
set +e

FAIL=0
mark_ok()   { echo "  $1  OK"; }
mark_miss() { echo "  $1  MISS"; FAIL=$((FAIL+1)); }
mark_bad()  { echo "  $1  BAD - $2"; FAIL=$((FAIL+1)); }

echo "═══ A 组：硬约束 ═══════════════════════════════════════════"

# A1 数据库驱动
if [ -d data ]; then mark_ok "A1 data/ 目录                       "
else mark_miss "A1 data/ 目录                       "; fi
if grep -q '"better-sqlite3"' package.json 2>/dev/null; then mark_ok "A1 better-sqlite3 安装              "
else mark_miss "A1 better-sqlite3 安装              "; fi
if grep -qE '"(sqlite3|node-sqlite3|sql\.js|pg|mysql2|mongodb|mongoose)"' package.json 2>/dev/null; then
  mark_bad  "A1 禁用驱动检测                     " "发现 sqlite3/pg/mysql2/mongodb 等驱动"
else mark_ok "A1 禁用驱动检测                     "; fi

# A2 WAL 模式
if grep -rq "journal_mode.*WAL" --include="*.js" --include="*.ts" --include="*.mjs" . 2>/dev/null; then
  mark_ok "A2 WAL 模式                         "
else mark_miss "A2 WAL 模式                         "; fi

# A3 DB_PATH env
if grep -rqE "process\.env\.[A-Z_]+_DB_PATH" --include="*.js" --include="*.ts" . 2>/dev/null; then
  mark_ok "A3 *_DB_PATH env 支持               "
else mark_miss "A3 *_DB_PATH env 支持               "; fi

DATA_REAL=$(realpath data 2>/dev/null)
if [ -n "$DATA_REAL" ] && echo "$DATA_REAL" | grep -qE "OneDrive|坚果云|Nutstore|Dropbox|GoogleDrive"; then
  mark_bad  "A3 data/ 不在云同步目录             " "$DATA_REAL"
else mark_ok "A3 data/ 不在云同步目录             "; fi

# A5 reports schema（如果有 sqlite3 cli 且 db 文件存在）
DB=$(find data -maxdepth 1 -name "*.db" 2>/dev/null | head -1)
if [ -n "$DB" ] && command -v sqlite3 >/dev/null 2>&1; then
  SCHEMA=$(sqlite3 "$DB" ".schema reports" 2>/dev/null)
  if echo "$SCHEMA" | grep -q "id INTEGER"; then mark_ok "A5 reports.id INTEGER               "; else mark_miss "A5 reports.id INTEGER               "; fi
  if echo "$SCHEMA" | grep -q "created_at INTEGER"; then mark_ok "A5 reports.created_at INTEGER       "; else mark_miss "A5 reports.created_at INTEGER       "; fi
  if echo "$SCHEMA" | grep -q "user_phone"; then mark_ok "A5 reports.user_phone               "; else mark_miss "A5 reports.user_phone               "; fi
  if echo "$SCHEMA" | grep -q "report_json"; then mark_ok "A5 reports.report_json              "; else mark_miss "A5 reports.report_json              "; fi
else
  echo "  A5 reports schema                    SKIP (没有 sqlite3 cli 或 db 文件还没生成；启动一次服务后再跑)"
fi

# A8 后端入口
if [ -f server.js ] || [ -f next.config.ts ] || [ -f next.config.js ] || [ -f next.config.mjs ]; then
  mark_ok "A8 后端入口存在                     "
else mark_miss "A8 后端入口存在                     "; fi

# A9 iron-session
if grep -q '"iron-session"' package.json 2>/dev/null; then mark_ok "A9 iron-session 安装                "
else mark_miss "A9 iron-session 安装                "; fi
if grep -qE '"(express-session|next-auth|jsonwebtoken|cookie-session)"' package.json 2>/dev/null; then
  mark_bad  "A9 禁用 session 库检测              " "用了 express-session/next-auth 等"
else mark_ok "A9 禁用 session 库检测              "; fi

# A10 .gitignore
if grep -q "^data/" .gitignore 2>/dev/null && grep -qE "\.env\.local|\.env\*\.local" .gitignore 2>/dev/null; then
  mark_ok "A10 .gitignore 完整                 "
else mark_miss "A10 .gitignore 完整                 "; fi

echo ""
echo "═══ B 组：工程规范 ════════════════════════════════════════"

if grep -rqE "VITE_BASE_PATH|basePath" --include="*.js" --include="*.ts" --include="next.config.*" . 2>/dev/null; then
  mark_ok "B3 basePath 就绪                    "
else mark_miss "B3 basePath 就绪                    "; fi
if grep -rqE "process\.env\.PORT" --include="*.js" --include="*.ts" . 2>/dev/null; then
  mark_ok "B2 PORT env 支持                    "
else mark_miss "B2 PORT env 支持                    "; fi
if grep -q '"dotenv"' package.json 2>/dev/null; then mark_ok "B  dotenv 安装                      "
else mark_miss "B  dotenv 安装                      "; fi
if grep -qE 'VITE_[A-Z_]*API_KEY|VITE_[A-Z_]*SECRET' .env.local 2>/dev/null .env.local.example 2>/dev/null; then
  mark_bad  "B5 API key 暴露检测                 " "VITE_*API_KEY 会泄露到浏览器 bundle"
else mark_ok "B5 API key 暴露检测                 "; fi

echo ""
echo "═══ C 组：文档 ════════════════════════════════════════════"

if [ -f README.md ]; then mark_ok "C1 README.md 存在                   "
else mark_miss "C1 README.md 存在                   "; fi
if [ -f .env.local.example ]; then mark_ok "C4 .env.local.example 存在          "
else mark_miss "C4 .env.local.example 存在          "; fi
if grep -qE "reports\s*\(|CREATE TABLE.*reports" README.md 2>/dev/null; then
  mark_ok "C2 README 含 schema                 "
else mark_miss "C2 README 含 schema                 "; fi
if grep -qE "DB_PATH|API_KEY|SESSION_PASSWORD" README.md 2>/dev/null; then
  mark_ok "C3 README 含 env 列表               "
else mark_miss "C3 README 含 env 列表               "; fi

PKG_NAME=$(grep -oP '"name":\s*"\K[^"]+' package.json 2>/dev/null | head -1)
DIR_NAME=$(basename "$(pwd)")
if [ "$PKG_NAME" = "$DIR_NAME" ] || echo "$PKG_NAME" | grep -qE "^(vite-project|my-app|web|test|demo|app)$"; then
  if echo "$PKG_NAME" | grep -qE "^(vite-project|my-app|web|test|demo|app)$"; then
    mark_bad  "C6 package.json name              " "name=$PKG_NAME 太泛用，应与目录名 $DIR_NAME 业务相关"
  else mark_ok "C6 package.json name                "; fi
else
  echo "  C6 package.json name                 WARN (name=$PKG_NAME，目录=$DIR_NAME，差异较大但非泛用)"
fi

echo ""
echo "═══ D 组：部署兼容 ════════════════════════════════════════"

if npm ci --dry-run 2>&1 | grep -q "Missing.*from lock file"; then
  mark_bad  "D1 npm ci --dry-run                 " "lock 漂移，重生 lock 后才能部署"
else mark_ok "D1 npm ci --dry-run                 "; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "═══ 全部 OK ═══════════════════════════════════════════════"
  echo "可以交付给 admin-hub 接管方了。"
  exit 0
else
  echo "═══ $FAIL 项未通过 ═══════════════════════════════════════════"
  echo "修复后再跑一次。详见 docs/对外接入规范.md。"
  exit 1
fi
