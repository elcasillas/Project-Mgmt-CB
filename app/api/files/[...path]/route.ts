import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/session";
import { getProjectFilesBucket } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await requireCurrentUser();
  const bucket = await getProjectFilesBucket();
  if (!bucket) {
    return NextResponse.json({ error: "PROJECT_FILES R2 binding is not configured." }, { status: 500 });
  }

  const { path } = await params;
  const key = path.join("/");
  const object = await bucket.get(key);
  if (!object) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
