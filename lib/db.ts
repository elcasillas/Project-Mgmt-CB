import { getCloudflareContext } from "@opennextjs/cloudflare";

export type SQLiteValue = string | number | null;

export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding DB is not configured.");
  }
  return env.DB;
}

export async function getProjectFilesBucket() {
  const { env } = await getCloudflareContext({ async: true });
  return env.PROJECT_FILES ?? null;
}

export function id() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

export function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export function fromBoolean(value: boolean) {
  return value ? 1 : 0;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function run(sql: string, ...params: SQLiteValue[]) {
  const db = await getDb();
  return db.prepare(sql).bind(...params).run();
}

export async function first<T>(sql: string, ...params: SQLiteValue[]) {
  const db = await getDb();
  return db.prepare(sql).bind(...params).first<T>();
}

export async function all<T>(sql: string, ...params: SQLiteValue[]) {
  const db = await getDb();
  const result = await db.prepare(sql).bind(...params).all<T>();
  return (result.results ?? []) as T[];
}

export async function logActivity(input: {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await run(
    `INSERT INTO activity_logs (id, user_id, entity_type, entity_id, action, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id(),
    input.userId,
    input.entityType,
    input.entityId,
    input.action,
    JSON.stringify(input.metadata ?? {}),
    now()
  );
}

export async function refreshProjectProgress(projectId: string | null | undefined) {
  if (!projectId) {
    return;
  }

  const counts = await first<{ total_count: number; done_count: number }>(
    `SELECT COUNT(*) AS total_count,
            SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) AS done_count
     FROM tasks
     WHERE project_id = ?`,
    projectId
  );

  const totalCount = counts?.total_count ?? 0;
  if (totalCount === 0) {
    return;
  }

  const progress = Math.round(((counts?.done_count ?? 0) / totalCount) * 100);
  await run(`UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?`, progress, now(), projectId);
}
