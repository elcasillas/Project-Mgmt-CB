"use server";

import { redirect } from "next/navigation";
import { loginWithPassword, logoutSession } from "@/lib/auth/session";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const result = await loginWithPassword(email, password);

  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  void formData;
  redirect("/signup?message=Account+creation+is+managed+by+your+administrator.");
}

export async function forgotPasswordAction(formData: FormData) {
  void formData;
  redirect("/forgot-password?message=Ask+an+administrator+to+reset+your+password.");
}

export async function logoutAction() {
  await logoutSession();
  redirect("/login");
}
