import type { Task, TaskPurchaseItem } from "@/lib/types/domain";
import { mapProfile } from "@/lib/auth/session";

export const TASK_WITH_RELATIONS_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(*),
  reporter:profiles!tasks_reporter_id_fkey(*),
  projects(id, name, status, priority, progress),
  task_dependencies!task_dependencies_task_id_fkey(depends_on_task_id)
`;

export function normalizeTaskPurchaseItems(value: unknown): TaskPurchaseItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID();
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      return [];
    }

    return [{ id, name }];
  });
}

export function mapTaskRecord(row: any): Task {
  let rawPurchaseItems: unknown = [];
  if (typeof row.purchase_items === "string") {
    try {
      rawPurchaseItems = JSON.parse(row.purchase_items || "[]");
    } catch {
      rawPurchaseItems = [];
    }
  } else if (Array.isArray(row.purchase_items)) {
    rawPurchaseItems = row.purchase_items;
  }

  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee_id: row.assignee_id,
    reporter_id: row.reporter_id,
    start_date: row.start_date,
    due_date: row.due_date,
    estimated_hours: row.estimated_hours,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee: row.assignee_id_full_name ? mapProfile(profileFromPrefix(row, "assignee")) : null,
    reporter: row.reporter_id_full_name ? mapProfile(profileFromPrefix(row, "reporter")) : null,
    project: row.projects
      ? {
          id: row.projects.id,
          name: row.projects.name,
          status: row.projects.status,
          priority: row.projects.priority,
          progress: row.projects.progress
        }
      : null,
    dependency_ids: typeof row.dependency_ids === "string" && row.dependency_ids ? row.dependency_ids.split(",").filter(Boolean) : [],
    purchaseItems: normalizeTaskPurchaseItems(rawPurchaseItems)
  };
}

function profileFromPrefix(row: any, prefix: "assignee" | "reporter") {
  return {
    id: row[`${prefix}_id_value`],
    first_name: row[`${prefix}_first_name`],
    last_name: row[`${prefix}_last_name`],
    full_name: row[`${prefix}_id_full_name`],
    email: row[`${prefix}_email`],
    role: row[`${prefix}_role`],
    status: row[`${prefix}_status`],
    avatar_url: row[`${prefix}_avatar_url`],
    created_at: row[`${prefix}_created_at`],
    updated_at: row[`${prefix}_updated_at`],
    last_active_at: row[`${prefix}_last_active_at`],
    deleted_at: row[`${prefix}_deleted_at`]
  };
}
