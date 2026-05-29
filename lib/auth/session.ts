import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { first, id, now, run } from "@/lib/db";
import type { Profile } from "@/lib/types/domain";

const SESSION_COOKIE = "pm_session";
const SESSION_DAYS = 14;

type ProfileRow = Profile & {
  password_hash: string | null;
};

export function mapProfile(row: any): Profile {
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status ?? "Active",
    avatar_url: row.avatar_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_active_at: row.last_active_at ?? null,
    deleted_at: row.deleted_at ?? null
  };
}

export async function hashPassword(password: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  const row = await first<ProfileRow>(
    `SELECT profiles.*
     FROM sessions
     JOIN profiles ON profiles.id = sessions.user_id
     WHERE sessions.id = ?
       AND sessions.expires_at > ?
       AND profiles.deleted_at IS NULL
       AND profiles.status != 'Inactive'`,
    sessionId,
    now()
  );

  return row ? mapProfile(row) : null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function loginWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await first<ProfileRow>(
    `SELECT *
     FROM profiles
     WHERE lower(email) = ?
       AND deleted_at IS NULL
       AND status != 'Inactive'`,
    normalizedEmail
  );

  if (!user?.password_hash) {
    return { ok: false as const, message: "Invalid email or password." };
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.password_hash) {
    return { ok: false as const, message: "Invalid email or password." };
  }

  const sessionId = id();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    sessionId,
    user.id,
    expiresAt,
    now()
  );
  await run(`UPDATE profiles SET last_active_at = ?, updated_at = ? WHERE id = ?`, now(), now(), user.id);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });

  return { ok: true as const, user: mapProfile(user) };
}

export async function logoutSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await run(`DELETE FROM sessions WHERE id = ?`, sessionId);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export function hasSessionCookie(request: { cookies: { get(name: string): { value: string } | undefined } }) {
  return Boolean(request.cookies.get(SESSION_COOKIE)?.value);
}
