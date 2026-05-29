import { headers } from "next/headers";
import Link from "next/link";
import { AuthShell } from "@/components/shared/auth-shell";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/lib/actions/auth";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <AuthShell title="Reset password" description="We’ll send a recovery link so you can set a new password securely.">
      <form action={forgotPasswordAction} className="space-y-5">
        <input type="hidden" name="origin" value={origin} />
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            autoComplete="email"
            data-lpignore="true"
          />
        </FormField>
        {params.error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.error}</p> : null}
        {params.message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{params.message}</p> : null}
        <Button className="w-full">Send recovery link</Button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        Remembered it?{" "}
        <Link href="/login" className="text-sky-600 hover:text-sky-700">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
