"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, requireCurrentUser } from "@/lib/auth/session";
import { first, id, now, run } from "@/lib/db";
import type { UserRole, UserStatus } from "@/lib/types/domain";

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

async function requireAdmin() {
  const user = await requireCurrentUser();
  if (user.role !== "Admin") {
    return { ok: false as const, message: "Only admins can manage users." };
  }
  return { ok: true as const, userId: user.id };
}

async function getActiveAdminCount() {
  const row = await first<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM profiles
     WHERE role = 'Admin'
       AND status = 'Active'
       AND deleted_at IS NULL`
  );
  return row?.count ?? 0;
}

export async function saveUserAction(input: {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  password?: string;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }

  const firstName = input.first_name.trim();
  const lastName = input.last_name.trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim() ?? "";

  if (!firstName || !lastName || !email || !input.role || !input.status) {
    return { ok: false as const, message: "All fields are required." };
  }

  if (!validateEmail(email)) {
    return { ok: false as const, message: "Enter a valid email address." };
  }

  if (!input.id && !password) {
    return { ok: false as const, message: "Password is required for new users." };
  }

  if (password && !validatePassword(password)) {
    return { ok: false as const, message: "Password must be at least 8 characters and include uppercase, lowercase, and a number." };
  }

  const duplicate = await first<{ id: string }>(
    `SELECT id
     FROM profiles
     WHERE lower(email) = ?
       AND deleted_at IS NULL
       AND id != ?`,
    email,
    input.id ?? ""
  );

  if (duplicate) {
    return { ok: false as const, message: "A user with that email already exists." };
  }

  const timestamp = now();

  if (input.id) {
    const existing = await first<{ role: UserRole; status: UserStatus }>(`SELECT role, status FROM profiles WHERE id = ?`, input.id);
    const activeAdminCount = await getActiveAdminCount();
    if (existing?.role === "Admin" && activeAdminCount <= 1 && (input.role !== "Admin" || input.status !== "Active")) {
      return { ok: false as const, message: "You cannot demote or deactivate the last remaining admin." };
    }

    const passwordHash = password ? await hashPassword(password) : null;
    if (passwordHash) {
      await run(
        `UPDATE profiles
         SET first_name = ?, last_name = ?, full_name = ?, email = ?, role = ?, status = ?, password_hash = ?, deleted_at = NULL, updated_at = ?
         WHERE id = ?`,
        firstName,
        lastName,
        fullName,
        email,
        input.role,
        input.status,
        passwordHash,
        timestamp,
        input.id
      );
    } else {
      await run(
        `UPDATE profiles
         SET first_name = ?, last_name = ?, full_name = ?, email = ?, role = ?, status = ?, deleted_at = NULL, updated_at = ?
         WHERE id = ?`,
        firstName,
        lastName,
        fullName,
        email,
        input.role,
        input.status,
        timestamp,
        input.id
      );
    }

    revalidatePath("/users");
    return { ok: true as const, message: "User updated." };
  }

  await run(
    `INSERT INTO profiles (id, first_name, last_name, full_name, email, password_hash, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id(),
    firstName,
    lastName,
    fullName,
    email,
    await hashPassword(password),
    input.role,
    input.status,
    timestamp,
    timestamp
  );

  revalidatePath("/users");
  return { ok: true as const, message: "User created." };
}

export async function removeUserAction(input: { id: string }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }

  if (input.id === auth.userId) {
    return { ok: false as const, message: "You cannot remove your own account." };
  }

  const profile = await first<{ id: string; role: UserRole; full_name: string }>(`SELECT id, role, full_name FROM profiles WHERE id = ?`, input.id);
  if (!profile) {
    return { ok: false as const, message: "User not found." };
  }

  const activeAdminCount = await getActiveAdminCount();
  if (profile.role === "Admin" && activeAdminCount <= 1) {
    return { ok: false as const, message: "You cannot remove the last remaining admin." };
  }

  await run(`UPDATE profiles SET status = 'Inactive', deleted_at = ?, updated_at = ? WHERE id = ?`, now(), now(), input.id);
  await run(`DELETE FROM sessions WHERE user_id = ?`, input.id);

  revalidatePath("/users");
  return { ok: true as const, message: `${profile.full_name} has been deactivated and removed from active views.` };
}
