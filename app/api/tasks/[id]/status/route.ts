import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { first, logActivity, now, refreshProjectProgress, run } from "@/lib/db";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/data/constants";
import type { TaskPriority, TaskStatus } from "@/lib/types/domain";

type QuickUpdateField = "status" | "priority";

function parseTaskUpdate(payload: unknown): { field: "status"; value: TaskStatus } | { field: "priority"; value: TaskPriority } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as { field?: QuickUpdateField; value?: string; status?: string; priority?: string };
  const field = body.field ?? (body.priority ? "priority" : "status");
  const value = body.value ?? (field === "priority" ? body.priority : body.status);

  if (field === "status" && TASK_STATUSES.includes(value as TaskStatus)) {
    return { field, value: value as TaskStatus };
  }

  if (field === "priority" && TASK_PRIORITIES.includes(value as TaskPriority)) {
    return { field, value: value as TaskPriority };
  }

  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const update = parseTaskUpdate(await request.json());

  if (!update) {
    return NextResponse.json({ error: "Invalid task update." }, { status: 400 });
  }

  const task = await first<{ project_id: string | null }>(`SELECT project_id FROM tasks WHERE id = ?`, id);
  if (update.field === "status") {
    await run(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, update.value, now(), id);
  } else {
    await run(`UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?`, update.value, now(), id);
  }
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: update.field === "status" ? "task_status_changed" : "task_priority_changed",
    metadata: { [update.field]: update.value }
  });

  if (update.field === "status") {
    await refreshProjectProgress(task?.project_id);
  }

  return NextResponse.json({ ok: true });
}
