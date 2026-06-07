import { NextRequest, NextResponse } from "next/server";
import { requireMenu, requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import {
  accessFilter,
  SERVICE_CATEGORY_KEYS,
  SERVICE_STATUS_KEYS,
  type ServiceCategory,
  type ServiceStatus,
  type ServiceRecordRow,
  type ServiceTrackingRow,
} from "@/lib/service-tracking";

interface DetailRow extends ServiceTrackingRow {
  recorder_name: string | null;
  staff1_name: string | null;
  staff2_name: string | null;
}

interface RecordWithRecorder extends ServiceRecordRow {
  recorder_name: string | null;
}

/**
 * GET /api/admin/service-tracking/[id]
 * 返回主行 + records 数组 + admins.name 映射
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const db = getDb();
  const filter = accessFilter(session);

  const conditions: string[] = ["st.id = ?"];
  const sqlParams: Array<string | number> = [id];
  if (filter.whereSql) {
    // accessFilter 默认表别名是 service_tracking 的字段名，无前缀
    // 这里我们直接在 SELECT 里给 st 别名，filter.whereSql 里的 staff1_admin_id/staff2_admin_id 在主表里——SQLite 会按列名解析
    conditions.push(filter.whereSql);
    sqlParams.push(...filter.params);
  }

  const row = db
    .prepare(
      `SELECT
         st.*,
         a_rec.name AS recorder_name,
         a_s1.name  AS staff1_name,
         a_s2.name  AS staff2_name
       FROM service_tracking st
       LEFT JOIN admins a_rec ON a_rec.id = st.recorder_admin_id
       LEFT JOIN admins a_s1  ON a_s1.id  = st.staff1_admin_id
       LEFT JOIN admins a_s2  ON a_s2.id  = st.staff2_admin_id
       WHERE ${conditions.join(" AND ")}`
    )
    .get(...sqlParams) as DetailRow | undefined;

  if (!row) {
    return NextResponse.json({ error: "记录不存在或无权访问" }, { status: 404 });
  }

  const records = db
    .prepare(
      `SELECT sr.*, a.name AS recorder_name
       FROM service_records sr
       LEFT JOIN admins a ON a.id = sr.recorder_admin_id
       WHERE sr.tracking_id = ?
       ORDER BY sr.service_at DESC`
    )
    .all(id) as RecordWithRecorder[];

  return NextResponse.json({ tracking: row, records });
}

/**
 * PATCH /api/admin/service-tracking/[id]
 * 可改字段：user_name, service_category, status, overall_note, staff1_admin_id, staff2_admin_id
 *
 * 采用原子 UPDATE WHERE id = ? AND (staff1 = ? OR staff2 = ?)（EC2），
 * `changes === 0` → 404 (id 不存在) 或 403 (无权)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  // 收集要改的字段
  const sets: string[] = [];
  const sqlParams: Array<string | number | null> = [];

  if (body.user_name !== undefined) {
    const raw = body.user_name;
    if (raw === null) {
      sets.push("user_name = ?");
      sqlParams.push(null);
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > 100) {
        return NextResponse.json({ error: "服务对象名称过长（最多 100 字）" }, { status: 400 });
      }
      sets.push("user_name = ?");
      sqlParams.push(trimmed === "" ? null : trimmed);
    } else {
      return NextResponse.json({ error: "服务对象格式错误" }, { status: 400 });
    }
  }

  if (body.service_category !== undefined) {
    const cat = String(body.service_category);
    if (!SERVICE_CATEGORY_KEYS.includes(cat as ServiceCategory)) {
      return NextResponse.json({ error: "服务分类无效" }, { status: 400 });
    }
    sets.push("service_category = ?");
    sqlParams.push(cat);
  }

  if (body.status !== undefined) {
    const st = String(body.status);
    if (!SERVICE_STATUS_KEYS.includes(st as ServiceStatus)) {
      return NextResponse.json({ error: "服务状态无效" }, { status: 400 });
    }
    sets.push("status = ?");
    sqlParams.push(st);
  }

  if (body.overall_note !== undefined) {
    sets.push("overall_note = ?");
    sqlParams.push(body.overall_note === null ? null : String(body.overall_note));
  }

  // staff1 / staff2 重新分配
  let newStaff1: number | undefined;
  let newStaff2: number | null | undefined;
  if (body.staff1_admin_id !== undefined) {
    const n = Number(body.staff1_admin_id);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "主服务人员无效" }, { status: 400 });
    }
    newStaff1 = n;
  }
  if (body.staff2_admin_id !== undefined) {
    const raw = body.staff2_admin_id;
    if (raw === null || raw === "" || raw === 0) {
      newStaff2 = null;
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "协同服务人员无效" }, { status: 400 });
      }
      newStaff2 = n;
    }
  }

  const db = getDb();

  // 若改 staff，需要先读当前行的另一侧值，做 staff1==staff2 应用层校验（EC4）
  // 并校验 staff 存在且 is_active=1
  if (newStaff1 !== undefined || newStaff2 !== undefined) {
    const currentRow = db
      .prepare(
        `SELECT staff1_admin_id, staff2_admin_id FROM service_tracking WHERE id = ?`
      )
      .get(id) as
      | { staff1_admin_id: number; staff2_admin_id: number | null }
      | undefined;
    if (!currentRow) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    const finalStaff1 = newStaff1 ?? currentRow.staff1_admin_id;
    const finalStaff2 =
      newStaff2 === undefined ? currentRow.staff2_admin_id : newStaff2;

    if (finalStaff2 !== null && finalStaff2 === finalStaff1) {
      return NextResponse.json(
        { error: "两位服务人员不能是同一人" },
        { status: 400 }
      );
    }

    // 校验存在且 active
    if (newStaff1 !== undefined) {
      const ok = db
        .prepare(`SELECT 1 FROM admins WHERE id = ? AND is_active = 1`)
        .get(newStaff1);
      if (!ok) {
        return NextResponse.json({ error: "主服务人员不存在或已停用" }, { status: 400 });
      }
      sets.push("staff1_admin_id = ?");
      sqlParams.push(newStaff1);
    }
    if (newStaff2 !== undefined) {
      if (newStaff2 !== null) {
        const ok = db
          .prepare(`SELECT 1 FROM admins WHERE id = ? AND is_active = 1`)
          .get(newStaff2);
        if (!ok) {
          return NextResponse.json({ error: "协同服务人员不存在或已停用" }, { status: 400 });
        }
      }
      sets.push("staff2_admin_id = ?");
      sqlParams.push(newStaff2);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  sets.push("updated_at = ?");
  sqlParams.push(Date.now());

  // ─── 原子 UPDATE WHERE 行级权限（EC2） ────────────────────────
  const whereParts = ["id = ?"];
  sqlParams.push(id);
  if (!session.isSuper) {
    whereParts.push("(staff1_admin_id = ? OR staff2_admin_id = ?)");
    sqlParams.push(session.adminId!, session.adminId!);
  }

  const result = db
    .prepare(
      `UPDATE service_tracking SET ${sets.join(", ")} WHERE ${whereParts.join(" AND ")}`
    )
    .run(...sqlParams);

  if (result.changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权修改" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/service-tracking/[id]
 * 整条删除服务跟踪 + 级联删 service_records（admin-hub 自己的表，硬删）。
 * 只允许超管。事务原子。
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限（仅超管可操作）" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const db = getDb();
  const result = db.transaction(() => {
    // 先删子表 records，再删主表，避免悬挂引用
    db.prepare("DELETE FROM service_records WHERE tracking_id = ?").run(id);
    return db.prepare("DELETE FROM service_tracking WHERE id = ?").run(id);
  })();

  if (result.changes === 0) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
