import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getProjectFilesBucket, id, now, run } from "@/lib/db";

export async function POST(request: Request) {
  const user = await requireCurrentUser();
  const bucket = await getProjectFilesBucket();

  if (!bucket) {
    return NextResponse.json({ error: "PROJECT_FILES R2 binding is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = String(formData.get("project_id") || "") || null;
  const taskId = String(formData.get("task_id") || "") || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  await bucket.put(filePath, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    }
  });

  const attachmentId = id();
  const timestamp = now();
  await run(
    `INSERT INTO attachments (id, project_id, task_id, file_name, file_path, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    attachmentId,
    projectId,
    taskId,
    file.name,
    filePath,
    user.id,
    timestamp
  );

  return NextResponse.json({
    data: {
      id: attachmentId,
      project_id: projectId,
      task_id: taskId,
      file_name: file.name,
      file_path: filePath,
      uploaded_by: user.id,
      created_at: timestamp
    }
  });
}
