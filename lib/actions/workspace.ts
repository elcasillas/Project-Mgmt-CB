"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
import { first, getProjectFilesBucket, id, logActivity, now, refreshProjectProgress, run } from "@/lib/db";
import { mapTaskRecord, normalizeTaskPurchaseItems } from "@/lib/data/task-record";

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTaskPurchaseItems(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    return normalizeTaskPurchaseItems(JSON.parse(value));
  } catch {
    return [];
  }
}

async function getCurrentUserRole() {
  const user = await requireCurrentUser();
  return { user, role: user.role };
}

export async function saveProjectAction(formData: FormData) {
  const { user, role } = await getCurrentUserRole();
  if (role !== "Admin" && role !== "Project Manager") {
    return { ok: false, message: "Only Admins and Managers can create or edit projects." };
  }

  const projectId = String(formData.get("id") || "");
  const savedProjectId = projectId || id();
  const timestamp = now();
  const payload = {
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || null,
    owner_id: String(formData.get("owner_id") || user.id),
    status: String(formData.get("status") || "Planning"),
    priority: String(formData.get("priority") || "Medium"),
    start_date: String(formData.get("start_date") || "") || null,
    target_end_date: String(formData.get("target_end_date") || "") || null,
    notes: String(formData.get("notes") || "") || null
  };

  if (projectId) {
    await run(
      `UPDATE projects
       SET name = ?, description = ?, owner_id = ?, status = ?, priority = ?, start_date = ?, target_end_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      payload.name,
      payload.description,
      payload.owner_id,
      payload.status,
      payload.priority,
      payload.start_date,
      payload.target_end_date,
      payload.notes,
      timestamp,
      projectId
    );
    await logActivity({ userId: user.id, entityType: "project", entityId: projectId, action: "project_updated", metadata: { projectName: payload.name } });
  } else {
    await run(
      `INSERT INTO projects (id, name, description, owner_id, status, priority, start_date, target_end_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      savedProjectId,
      payload.name,
      payload.description,
      payload.owner_id,
      payload.status,
      payload.priority,
      payload.start_date,
      payload.target_end_date,
      payload.notes,
      timestamp,
      timestamp
    );
    await logActivity({ userId: user.id, entityType: "project", entityId: savedProjectId, action: "project_created", metadata: { projectName: payload.name } });
  }

  const memberIds = splitCsv(String(formData.get("team_members") || ""));
  await run(`DELETE FROM project_members WHERE project_id = ?`, savedProjectId);
  const uniqueMemberIds = Array.from(new Set([payload.owner_id, ...memberIds]));
  for (const memberId of uniqueMemberIds) {
    await run(
      `INSERT OR IGNORE INTO project_members (id, project_id, user_id, created_at)
       VALUES (?, ?, ?, ?)`,
      id(),
      savedProjectId,
      memberId,
      timestamp
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath(`/projects/${savedProjectId}`);
  return { ok: true, message: projectId ? "Project updated." : "Project created." };
}

export async function archiveProjectAction(formData: FormData) {
  const { user, role } = await getCurrentUserRole();
  if (role !== "Admin" && role !== "Project Manager") {
    redirect("/projects?error=Only+Admins+and+Managers+can+archive+projects.");
  }

  const projectId = String(formData.get("project_id") || "");
  await run(`UPDATE projects SET archived = 1, updated_at = ? WHERE id = ?`, now(), projectId);
  await logActivity({ userId: user.id, entityType: "project", entityId: projectId, action: "project_archived" });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects?success=Project archived.");
}

export async function saveTaskAction(formData: FormData) {
  const user = await requireCurrentUser();
  const taskId = String(formData.get("id") || "");
  const savedTaskId = taskId || id();
  const timestamp = now();
  const purchaseItems = parseTaskPurchaseItems(formData.get("purchase_items"));
  const payload = {
    project_id: String(formData.get("project_id") || "") || null,
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || "") || null,
    status: String(formData.get("status") || "Not Started"),
    priority: String(formData.get("priority") || "Medium"),
    assignee_id: String(formData.get("assignee_id") || "") || null,
    reporter_id: String(formData.get("reporter_id") || user.id) || null,
    start_date: String(formData.get("start_date") || "") || null,
    due_date: String(formData.get("due_date") || "") || null,
    estimated_hours: Number(formData.get("estimated_hours") || 0) || null,
    purchase_items: JSON.stringify(purchaseItems)
  };

  const previous = taskId ? await first<{ project_id: string | null }>(`SELECT project_id FROM tasks WHERE id = ?`, taskId) : null;

  if (taskId) {
    await run(
      `UPDATE tasks
       SET project_id = ?, title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, reporter_id = ?, start_date = ?, due_date = ?, estimated_hours = ?, purchase_items = ?, updated_at = ?
       WHERE id = ?`,
      payload.project_id,
      payload.title,
      payload.description,
      payload.status,
      payload.priority,
      payload.assignee_id,
      payload.reporter_id,
      payload.start_date,
      payload.due_date,
      payload.estimated_hours,
      payload.purchase_items,
      timestamp,
      taskId
    );
    await logActivity({ userId: user.id, entityType: "task", entityId: taskId, action: "task_updated", metadata: { title: payload.title, status: payload.status } });
  } else {
    await run(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, reporter_id, start_date, due_date, estimated_hours, purchase_items, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      savedTaskId,
      payload.project_id,
      payload.title,
      payload.description,
      payload.status,
      payload.priority,
      payload.assignee_id,
      payload.reporter_id,
      payload.start_date,
      payload.due_date,
      payload.estimated_hours,
      payload.purchase_items,
      timestamp,
      timestamp
    );
    await logActivity({ userId: user.id, entityType: "task", entityId: savedTaskId, action: "task_created", metadata: { title: payload.title } });
  }

  const dependencyIds = splitCsv(String(formData.get("dependency_ids") || ""));
  await run(`DELETE FROM task_dependencies WHERE task_id = ?`, savedTaskId);
  for (const dependsOnTaskId of dependencyIds) {
    await run(
      `INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_task_id)
       VALUES (?, ?, ?)`,
      id(),
      savedTaskId,
      dependsOnTaskId
    );
  }

  await refreshProjectProgress(payload.project_id);
  if (previous?.project_id && previous.project_id !== payload.project_id) {
    await refreshProjectProgress(previous.project_id);
  }

  const savedTaskRow = await first<any>(`SELECT * FROM tasks WHERE id = ?`, savedTaskId);
  const savedTask = savedTaskRow ? mapTaskRecord(savedTaskRow) : null;

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  if (payload.project_id) {
    revalidatePath(`/projects/${payload.project_id}`);
  }
  return { ok: true, message: taskId ? "Task updated." : "Task created.", task: savedTask };
}

export async function updateTaskStatusAction(formData: FormData) {
  const user = await requireCurrentUser();
  const taskId = String(formData.get("task_id") || "");
  const status = String(formData.get("status") || "");
  const task = await first<{ project_id: string | null }>(`SELECT project_id FROM tasks WHERE id = ?`, taskId);

  await run(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, status, now(), taskId);
  await logActivity({ userId: user.id, entityType: "task", entityId: taskId, action: "task_status_changed", metadata: { status } });
  await refreshProjectProgress(task?.project_id);

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(formData: FormData) {
  const user = await requireCurrentUser();
  const taskId = String(formData.get("task_id") || "");
  const task = await first<{ project_id: string | null }>(`SELECT project_id FROM tasks WHERE id = ?`, taskId);
  await run(`DELETE FROM tasks WHERE id = ?`, taskId);
  await logActivity({ userId: user.id, entityType: "task", entityId: taskId, action: "task_deleted" });
  await refreshProjectProgress(task?.project_id);

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function addCommentAction(formData: FormData) {
  const user = await requireCurrentUser();
  const taskId = String(formData.get("task_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const body = String(formData.get("body") || "");

  await run(`INSERT INTO comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)`, id(), taskId, user.id, body, now());
  await logActivity({ userId: user.id, entityType: "task", entityId: taskId, action: "comment_added", metadata: { body } });

  revalidatePath("/tasks");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

export async function deleteAttachmentAction(formData: FormData) {
  await requireCurrentUser();
  const attachmentId = String(formData.get("attachment_id") || "");
  const filePath = String(formData.get("file_path") || "");
  const projectId = String(formData.get("project_id") || "");
  const bucket = await getProjectFilesBucket();

  if (bucket && filePath) {
    await bucket.delete(filePath);
  }

  await run(`DELETE FROM attachments WHERE id = ?`, attachmentId);
  revalidatePath("/tasks");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireCurrentUser();
  const fullName = String(formData.get("full_name") || "");
  const avatarUrl = String(formData.get("avatar_url") || "") || null;
  await run(`UPDATE profiles SET full_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?`, fullName, avatarUrl, now(), user.id);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updateWorkspaceSettingsAction(formData: FormData) {
  await requireCurrentUser();
  const current = await first<{ id: string }>(`SELECT id FROM workspace_settings ORDER BY created_at LIMIT 1`);
  if (!current?.id) {
    redirect("/settings?error=Workspace settings record not found.");
  }

  await run(
    `UPDATE workspace_settings
     SET workspace_name = ?, default_project_status = ?, default_project_priority = ?, notifications_enabled = ?, updated_at = ?
     WHERE id = ?`,
    String(formData.get("workspace_name") || "Northstar PM"),
    String(formData.get("default_project_status") || "Planning"),
    String(formData.get("default_project_priority") || "Medium"),
    String(formData.get("notifications_enabled") || "off") === "on" ? 1 : 0,
    now(),
    current.id
  );

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
