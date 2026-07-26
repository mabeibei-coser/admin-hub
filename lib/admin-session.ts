import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { ASSIGNABLE_MENUS, type StoredMenuKey } from "./menus";

export interface AdminSession {
  adminId?: number;
  username?: string; // 手机号
  name?: string;
  isSuper?: boolean;
  menus?: Array<StoredMenuKey>; // DB 原值；不含 "admins"（由 isSuper 派生）
  loggedInAt?: number; // ms timestamp — 用于 session_invalid_after 对比
}

/** 反序列化 menus_json 时只放行白名单 key，避免老 cookie 残留废 key 影响逻辑 */
const VALID_STORED_MENUS = new Set<string>(
  ASSIGNABLE_MENUS.map((m) => m.key)
);
function parseStoredMenus(raw: string): StoredMenuKey[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is StoredMenuKey =>
        typeof k === "string" && VALID_STORED_MENUS.has(k)
    );
  } catch {
    return [];
  }
}

const sessionOptions: SessionOptions = {
  password: process.env.ADMIN_SESSION_PASSWORD!,
  cookieName: "career_admin_session",
  cookieOptions: {
    secure:
      process.env.ADMIN_COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/b100", // 生产 nginx 反代用 /b100/ 子路径，cookie 只发给 /b100/* 路径
    maxAge: 60 * 60 * 24 * 7, // 7 天
  },
};

export async function getAdminSession() {
  return getIronSession<AdminSession>(await cookies(), sessionOptions);
}

// ---------- 内部工具 ----------

interface AdminRow {
  id: number;
  username: string;
  name: string;
  password_hash: string;
  menus_json: string;
  is_super: number;
  is_active: number;
  session_invalid_after: number | null;
}

/**
 * 防时序攻击用的 dummy hash（cost=10）。
 * 当用户名不存在时仍跑一次 bcrypt.compare，避免响应时差暴露账号是否存在（Eng M8）。
 */
const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lh7y";

/**
 * 检查当前 session 是否已被服务端强制失效。
 * 两种情况：账号被停用、或管理员改密/被改密后踢出（M3）。
 * 直接查 DB（better-sqlite3 同步），成本极低。
 */
function isSessionInvalidated(session: AdminSession): boolean {
  if (!session.adminId || !session.loggedInAt) return false;
  try {
    const row = getDb()
      .prepare(
        "SELECT is_active, session_invalid_after FROM admins WHERE id = ?"
      )
      .get(session.adminId) as
      | { is_active: number; session_invalid_after: number | null }
      | undefined;
    if (!row) return true;
    if (!row.is_active) return true;
    if (
      row.session_invalid_after &&
      session.loggedInAt < row.session_invalid_after
    )
      return true;
    return false;
  } catch {
    return false; // DB 不可用时不强制踢出，让业务层处理
  }
}

// ---------- 公共 API ----------

/**
 * 登录：从 DB 查 username → 校验密码 → 写 session。
 * 不论 username 是否存在都跑完整 bcrypt，防止时序差异泄露账号存在性。
 */
export async function loginAdmin(
  username: string,
  password: string
): Promise<
  | { ok: true }
  | { ok: false; reason: "not_found" | "bad_password" | "disabled" }
> {
  const row = getDb()
    .prepare(
      `SELECT id, username, name, password_hash, menus_json,
              is_super, is_active
       FROM admins WHERE username = ?`
    )
    .get(username) as AdminRow | undefined;

  if (!row) {
    await bcrypt.compare(password, DUMMY_HASH); // 防时序
    return { ok: false, reason: "not_found" };
  }

  const passwordOk = await bcrypt.compare(password, row.password_hash);
  if (!passwordOk) return { ok: false, reason: "bad_password" };
  if (!row.is_active) return { ok: false, reason: "disabled" };

  const s = await getAdminSession();
  s.adminId = row.id;
  s.username = row.username;
  s.name = row.name;
  s.isSuper = row.is_super === 1;
  s.menus = parseStoredMenus(row.menus_json);
  s.loggedInAt = Date.now();
  await s.save();
  return { ok: true };
}

/**
 * 返回当前已登录的 AdminSession，否则返回 null。
 * 路由顶端用法：
 *   const session = await requireAdmin();
 *   if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const s = await getAdminSession();
  if (!s.adminId) return null;
  if (isSessionInvalidated(s)) {
    await s.destroy();
    return null;
  }
  return s;
}

/**
 * 要求超管权限。
 * 路由顶端用法：
 *   const session = await requireSuper();
 *   if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
 */
export async function requireSuper(): Promise<AdminSession | null> {
  const s = await requireAdmin();
  if (!s) return null;
  return s.isSuper ? s : null;
}

/**
 * 凭证中心专用的 fail-closed 超管鉴权。
 *
 * 普通后台沿用 requireSuper 的既有可用性语义；凭证中心属于高敏模块，
 * 因此管理员库不可读、账号停用、会话失效或超管身份已撤销时一律拒绝。
 */
export async function requireCredentialSuper(): Promise<AdminSession | null> {
  const s = await getAdminSession();
  if (!s.adminId || !s.loggedInAt) return null;
  try {
    const row = getDb()
      .prepare(
        `SELECT is_active, is_super, session_invalid_after
         FROM admins WHERE id = ?`,
      )
      .get(s.adminId) as
      | {
          is_active: number;
          is_super: number;
          session_invalid_after: number | null;
        }
      | undefined;
    const invalid =
      !row ||
      row.is_active !== 1 ||
      row.is_super !== 1 ||
      (row.session_invalid_after != null && s.loggedInAt < row.session_invalid_after);
    if (invalid) {
      await s.destroy();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/**
 * 要求对指定菜单有权限（超管自动通过）。
 * 路由顶端用法：
 *   const session = await requireMenu("report");
 *   if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
 */
export async function requireMenu(
  menu: StoredMenuKey
): Promise<AdminSession | null> {
  const s = await requireAdmin();
  if (!s) return null;
  if (s.isSuper) return s;
  return s.menus?.includes(menu) ? s : null;
}

/** 登出：销毁 session cookie。 */
export async function logoutAdmin(): Promise<void> {
  const s = await getAdminSession();
  await s.destroy();
}
