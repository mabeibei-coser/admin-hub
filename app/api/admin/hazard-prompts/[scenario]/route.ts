import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import {
  readPrompts,
  writeScenario,
  validateScenario,
  type ScenarioPrompt,
} from "@/lib/hazard-prompts";

/**
 * PUT /api/admin/hazard-prompts/[scenario]
 * Body: { name, context, focus[] }
 * 写入单个场景；同时同步 labels[scenarioId] = name。
 * 仅超管。
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ scenario: string }> },
) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { scenario: scenarioId } = await params;
  if (!scenarioId || typeof scenarioId !== "string") {
    return NextResponse.json({ error: "场景 id 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as ScenarioPrompt | null;
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const validationError = validateScenario(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // 检查 scenario id 是否在现有 prompts 里
  const existing = readPrompts();
  if (!(scenarioId in existing.prompts)) {
    return NextResponse.json(
      { error: `场景 id 不存在：${scenarioId}` },
      { status: 404 },
    );
  }

  try {
    writeScenario(scenarioId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "写入失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
