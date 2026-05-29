"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border border-gray-200 bg-white p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">Workspace Error</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">A server-side error occurred while loading this workspace view.</h1>
        {error.digest ? <p className="mt-3 text-sm text-slate-600">Digest: {error.digest}</p> : null}
        <p className="mt-3 text-sm text-slate-600">Cloudflare Worker logs will include the failing query scope under the `[queries]` prefix.</p>
        <Button className="mt-6" onClick={reset}>
          Retry
        </Button>
      </div>
    </div>
  );
}
