import { getCurrentUser, mapProfile } from "@/lib/auth/session";
import { all, first, parseJson, toBoolean } from "@/lib/db";
import { isApproaching, isDueThisWeek, isOverdue } from "@/lib/utils/format";
import { mapTaskRecord } from "@/lib/data/task-record";
import type { ActivityLog, Attachment, Comment, DashboardMetrics, Profile, Project, Task, UserDirectoryEntry } from "@/lib/types/domain";

function serializeError(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) };
}

function logQueryError(scope: string, error: unknown, metadata?: Record<string, unknown>) {
  console.error(`[queries] ${scope} failed`, { ...metadata, error: serializeError(error) });
}

function mapProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    owner_id: row.owner_id,
    status: row.status,
    priority: row.priority,
    start_date: row.start_date,
    target_end_date: row.target_end_date,
    progress: row.progress,
    archived: toBoolean(row.archived),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: row.owner_full_name
      ? mapProfile({
          id: row.owner_id,
          first_name: row.owner_first_name,
          last_name: row.owner_last_name,
          full_name: row.owner_full_name,
          email: row.owner_email,
          role: row.owner_role,
          status: row.owner_status,
          avatar_url: row.owner_avatar_url,
          created_at: row.owner_created_at,
          updated_at: row.owner_updated_at,
          last_active_at: row.owner_last_active_at,
          deleted_at: row.owner_deleted_at
        })
      : undefined,
    members: parseJson<any[]>(row.members_json, []).map(mapProfile),
    task_count: row.task_count ?? undefined,
    overdue_task_count: row.overdue_task_count ?? undefined
  };
}

function mapAttachment(row: any): Attachment {
  return {
    id: row.id,
    project_id: row.project_id,
    task_id: row.task_id,
    file_name: row.file_name,
    file_path: row.file_path,
    file_url: `/api/files/${encodeURIComponent(row.file_path)}`,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    uploader: row.uploader_full_name
      ? mapProfile({
          id: row.uploaded_by,
          first_name: row.uploader_first_name,
          last_name: row.uploader_last_name,
          full_name: row.uploader_full_name,
          email: row.uploader_email,
          role: row.uploader_role,
          status: row.uploader_status,
          avatar_url: row.uploader_avatar_url,
          created_at: row.uploader_created_at,
          updated_at: row.uploader_updated_at,
          last_active_at: row.uploader_last_active_at,
          deleted_at: row.uploader_deleted_at
        })
      : undefined
  };
}

function mapComment(row: any): Comment {
  return {
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    author: row.author_full_name
      ? mapProfile({
          id: row.user_id,
          first_name: row.author_first_name,
          last_name: row.author_last_name,
          full_name: row.author_full_name,
          email: row.author_email,
          role: row.author_role,
          status: row.author_status,
          avatar_url: row.author_avatar_url,
          created_at: row.author_created_at,
          updated_at: row.author_updated_at,
          last_active_at: row.author_last_active_at,
          deleted_at: row.author_deleted_at
        })
      : undefined
  };
}

function mapActivity(row: any): ActivityLog {
  return {
    id: row.id,
    user_id: row.user_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    metadata: parseJson<Record<string, unknown> | null>(row.metadata, null),
    created_at: row.created_at,
    actor: row.actor_full_name
      ? mapProfile({
          id: row.user_id,
          first_name: row.actor_first_name,
          last_name: row.actor_last_name,
          full_name: row.actor_full_name,
          email: row.actor_email,
          role: row.actor_role,
          status: row.actor_status,
          avatar_url: row.actor_avatar_url,
          created_at: row.actor_created_at,
          updated_at: row.actor_updated_at,
          last_active_at: row.actor_last_active_at,
          deleted_at: row.actor_deleted_at
        })
      : undefined
  };
}

const PROJECT_SELECT = `
  SELECT p.*,
         owner.first_name AS owner_first_name,
         owner.last_name AS owner_last_name,
         owner.full_name AS owner_full_name,
         owner.email AS owner_email,
         owner.role AS owner_role,
         owner.status AS owner_status,
         owner.avatar_url AS owner_avatar_url,
         owner.created_at AS owner_created_at,
         owner.updated_at AS owner_updated_at,
         owner.last_active_at AS owner_last_active_at,
         owner.deleted_at AS owner_deleted_at,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'Done' AND t.due_date < date('now')) AS overdue_task_count,
         COALESCE((
           SELECT json_group_array(json_object(
             'id', m.id,
             'first_name', m.first_name,
             'last_name', m.last_name,
             'full_name', m.full_name,
             'email', m.email,
             'role', m.role,
             'status', m.status,
             'avatar_url', m.avatar_url,
             'created_at', m.created_at,
             'updated_at', m.updated_at,
             'last_active_at', m.last_active_at,
             'deleted_at', m.deleted_at
           ))
           FROM project_members pm
           JOIN profiles m ON m.id = pm.user_id
           WHERE pm.project_id = p.id
         ), '[]') AS members_json
  FROM projects p
  JOIN profiles owner ON owner.id = p.owner_id
`;

const TASK_SELECT = `
  SELECT t.*,
         assignee.id AS assignee_id_value,
         assignee.first_name AS assignee_first_name,
         assignee.last_name AS assignee_last_name,
         assignee.full_name AS assignee_id_full_name,
         assignee.email AS assignee_email,
         assignee.role AS assignee_role,
         assignee.status AS assignee_status,
         assignee.avatar_url AS assignee_avatar_url,
         assignee.created_at AS assignee_created_at,
         assignee.updated_at AS assignee_updated_at,
         assignee.last_active_at AS assignee_last_active_at,
         assignee.deleted_at AS assignee_deleted_at,
         reporter.id AS reporter_id_value,
         reporter.first_name AS reporter_first_name,
         reporter.last_name AS reporter_last_name,
         reporter.full_name AS reporter_id_full_name,
         reporter.email AS reporter_email,
         reporter.role AS reporter_role,
         reporter.status AS reporter_status,
         reporter.avatar_url AS reporter_avatar_url,
         reporter.created_at AS reporter_created_at,
         reporter.updated_at AS reporter_updated_at,
         reporter.last_active_at AS reporter_last_active_at,
         reporter.deleted_at AS reporter_deleted_at,
         projects.id AS project_id_value,
         projects.name AS project_name,
         projects.status AS project_status,
         projects.priority AS project_priority,
         projects.progress AS project_progress,
         (SELECT group_concat(depends_on_task_id, ',') FROM task_dependencies WHERE task_id = t.id) AS dependency_ids
  FROM tasks t
  LEFT JOIN profiles assignee ON assignee.id = t.assignee_id
  LEFT JOIN profiles reporter ON reporter.id = t.reporter_id
  LEFT JOIN projects ON projects.id = t.project_id
`;

function mapTask(row: any): Task {
  return mapTaskRecord({
    ...row,
    projects: row.project_id_value
      ? {
          id: row.project_id_value,
          name: row.project_name,
          status: row.project_status,
          priority: row.project_priority,
          progress: row.project_progress
        }
      : null
  });
}

export async function getCurrentProfile() {
  return getCurrentUser();
}

export async function getWorkspaceSettings() {
  try {
    const row = await first<any>(`SELECT * FROM workspace_settings ORDER BY created_at LIMIT 1`);
    return row ? { ...row, notifications_enabled: toBoolean(row.notifications_enabled) } : null;
  } catch (error) {
    logQueryError("getWorkspaceSettings", error);
    throw error;
  }
}

export async function getProjects(): Promise<Project[]> {
  try {
    const rows = await all<any>(`${PROJECT_SELECT} WHERE p.archived = 0 ORDER BY p.updated_at DESC`);
    return rows.map(mapProject);
  } catch (error) {
    logQueryError("getProjects", error);
    throw error;
  }
}

export async function getProjectDetail(projectId: string) {
  try {
    const [project, tasks, activity, taskIdRows, attachments] = await Promise.all([
      first<any>(`${PROJECT_SELECT} WHERE p.id = ?`, projectId),
      all<any>(`${TASK_SELECT} WHERE t.project_id = ? ORDER BY t.updated_at DESC`, projectId),
      getActivityForEntity(projectId),
      all<{ id: string }>(`SELECT id FROM tasks WHERE project_id = ?`, projectId),
      getProjectAttachments(projectId)
    ]);

    if (!project) {
      throw new Error("Project not found.");
    }

    const taskIds = (taskIdRows as Array<{ id: string }>).map((task) => task.id);
    const comments = await getTaskComments(taskIds);
    return {
      project: mapProject(project),
      tasks: tasks.map(mapTask),
      activity,
      comments,
      attachments
    };
  } catch (error) {
    logQueryError("getProjectDetail", error, { projectId });
    throw error;
  }
}

export async function getTasks(): Promise<Task[]> {
  try {
    const rows = await all<any>(`${TASK_SELECT} ORDER BY t.updated_at DESC`);
    return rows.map(mapTask);
  } catch (error) {
    logQueryError("getTasks", error);
    throw error;
  }
}

export async function getTaskDetail(taskId: string) {
  const [task, comments, attachments] = await Promise.all([
    first<any>(`${TASK_SELECT} WHERE t.id = ?`, taskId),
    getTaskComments([taskId]),
    getTaskAttachments([taskId])
  ]);

  if (!task) {
    throw new Error("Task not found.");
  }

  return { task: mapTask(task), comments, attachments };
}

export async function getTaskCommentsAndAttachments(taskIds: string[]) {
  if (!taskIds.length) {
    return { comments: [] as Comment[], attachments: [] as Attachment[] };
  }
  const [comments, attachments] = await Promise.all([getTaskComments(taskIds), getTaskAttachments(taskIds)]);
  return { comments, attachments };
}

export async function getTaskAttachments(taskIds: string[]) {
  if (!taskIds.length) {
    return [] as Attachment[];
  }
  const placeholders = taskIds.map(() => "?").join(",");
  const rows = await all<any>(
    `SELECT a.*,
            u.first_name AS uploader_first_name,
            u.last_name AS uploader_last_name,
            u.full_name AS uploader_full_name,
            u.email AS uploader_email,
            u.role AS uploader_role,
            u.status AS uploader_status,
            u.avatar_url AS uploader_avatar_url,
            u.created_at AS uploader_created_at,
            u.updated_at AS uploader_updated_at,
            u.last_active_at AS uploader_last_active_at,
            u.deleted_at AS uploader_deleted_at
     FROM attachments a
     JOIN profiles u ON u.id = a.uploaded_by
     WHERE a.task_id IN (${placeholders})
     ORDER BY a.created_at DESC`,
    ...taskIds
  );
  return rows.map(mapAttachment);
}

async function getProjectAttachments(projectId: string): Promise<Attachment[]> {
  const rows = await all<any>(
    `SELECT a.*,
            u.first_name AS uploader_first_name,
            u.last_name AS uploader_last_name,
            u.full_name AS uploader_full_name,
            u.email AS uploader_email,
            u.role AS uploader_role,
            u.status AS uploader_status,
            u.avatar_url AS uploader_avatar_url,
            u.created_at AS uploader_created_at,
            u.updated_at AS uploader_updated_at,
            u.last_active_at AS uploader_last_active_at,
            u.deleted_at AS uploader_deleted_at
     FROM attachments a
     JOIN profiles u ON u.id = a.uploaded_by
     WHERE a.project_id = ?
     ORDER BY a.created_at DESC`,
    projectId
  );
  return rows.map(mapAttachment);
}

async function getTaskComments(taskIds: string[]): Promise<Comment[]> {
  if (!taskIds.length) {
    return [] as Comment[];
  }
  const placeholders = taskIds.map(() => "?").join(",");
  const rows = await all<any>(
    `SELECT c.*,
            author.first_name AS author_first_name,
            author.last_name AS author_last_name,
            author.full_name AS author_full_name,
            author.email AS author_email,
            author.role AS author_role,
            author.status AS author_status,
            author.avatar_url AS author_avatar_url,
            author.created_at AS author_created_at,
            author.updated_at AS author_updated_at,
            author.last_active_at AS author_last_active_at,
            author.deleted_at AS author_deleted_at
     FROM comments c
     JOIN profiles author ON author.id = c.user_id
     WHERE c.task_id IN (${placeholders})
     ORDER BY c.created_at ASC`,
    ...taskIds
  );
  return rows.map(mapComment);
}

export async function getTeamMembers(): Promise<Array<Profile & { activeProjects: number; assignedTasks: number; workloadSummary: number }>> {
  try {
    const profiles = await all<any>(`SELECT * FROM profiles WHERE deleted_at IS NULL ORDER BY full_name`);
    const projectMemberships = await all<{ user_id: string }>(`SELECT user_id FROM project_members`);
    const tasks = await all<{ assignee_id: string | null; status: string }>(`SELECT assignee_id, status FROM tasks`);
    return profiles.map((row: any) => {
      const profile = mapProfile(row);
      return {
        ...profile,
        activeProjects: projectMemberships.filter((entry) => entry.user_id === profile.id).length,
        assignedTasks: tasks.filter((task) => task.assignee_id === profile.id).length,
        workloadSummary: tasks.filter((task) => task.assignee_id === profile.id && task.status !== "Done").length
      };
    });
  } catch (error) {
    logQueryError("getTeamMembers", error);
    throw error;
  }
}

export async function getUsersDirectory(): Promise<UserDirectoryEntry[]> {
  try {
    const profiles = await all<any>(`SELECT * FROM profiles WHERE deleted_at IS NULL ORDER BY created_at DESC`);
    const membershipRows = await all<{ user_id: string }>(`SELECT user_id FROM project_members`);
    const taskRows = await all<{ assignee_id: string | null }>(`SELECT assignee_id FROM tasks`);
    return profiles.map((row: any) => {
      const profile = mapProfile(row);
      return {
        ...profile,
        assignedProjects: membershipRows.filter((entry) => entry.user_id === profile.id).length,
        assignedTasks: taskRows.filter((task) => task.assignee_id === profile.id).length
      };
    }) as UserDirectoryEntry[];
  } catch (error) {
    logQueryError("getUsersDirectory", error);
    throw error;
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const [projects, tasks, activity] = await Promise.all([getProjects(), getTasks(), getRecentActivity()]);
    const activeProjects = projects.filter((project) => project.status === "Active");
    const overdueTasks = tasks.filter((task) => isOverdue(task.due_date, task.status === "Done"));
    const dueThisWeek = tasks.filter((task) => isDueThisWeek(task.due_date) && task.status !== "Done");
    const atRisk = projects.filter(
      (project) =>
        (project.target_end_date && isApproaching(project.target_end_date) && project.progress < 60) ||
        tasks.some((task) => task.project_id === project.id && isOverdue(task.due_date, task.status === "Done"))
    );

    return {
      totalActiveProjects: activeProjects.length,
      totalTasks: tasks.length,
      tasksDueThisWeek: dueThisWeek.length,
      overdueTasks: overdueTasks.length,
      projectsAtRisk: atRisk.length,
      tasksByStatus: ["Not Started", "In Progress", "Blocked", "In Review", "Done"].map((status) => ({
        status,
        count: tasks.filter((task) => task.status === status).length
      })) as DashboardMetrics["tasksByStatus"],
      recentTasks: tasks.slice(0, 6),
      recentActivity: activity.slice(0, 8),
      spotlightProjects: atRisk.slice(0, 3)
    };
  } catch (error) {
    logQueryError("getDashboardMetrics", error);
    throw error;
  }
}

async function getActivityForEntity(entityId: string) {
  const rows = await all<any>(
    `SELECT l.*,
            actor.first_name AS actor_first_name,
            actor.last_name AS actor_last_name,
            actor.full_name AS actor_full_name,
            actor.email AS actor_email,
            actor.role AS actor_role,
            actor.status AS actor_status,
            actor.avatar_url AS actor_avatar_url,
            actor.created_at AS actor_created_at,
            actor.updated_at AS actor_updated_at,
            actor.last_active_at AS actor_last_active_at,
            actor.deleted_at AS actor_deleted_at
     FROM activity_logs l
     JOIN profiles actor ON actor.id = l.user_id
     WHERE l.entity_id = ?
     ORDER BY l.created_at DESC
     LIMIT 20`,
    entityId
  );
  return rows.map(mapActivity);
}

export async function getRecentActivity() {
  try {
    const rows = await all<any>(
      `SELECT l.*,
              actor.first_name AS actor_first_name,
              actor.last_name AS actor_last_name,
              actor.full_name AS actor_full_name,
              actor.email AS actor_email,
              actor.role AS actor_role,
              actor.status AS actor_status,
              actor.avatar_url AS actor_avatar_url,
              actor.created_at AS actor_created_at,
              actor.updated_at AS actor_updated_at,
              actor.last_active_at AS actor_last_active_at,
              actor.deleted_at AS actor_deleted_at
       FROM activity_logs l
       JOIN profiles actor ON actor.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 20`
    );
    return rows.map(mapActivity);
  } catch (error) {
    logQueryError("getRecentActivity", error);
    throw error;
  }
}
