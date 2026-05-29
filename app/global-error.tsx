"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">Application Error</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">A server-side error occurred while loading the application.</h1>
          <p className="mt-3 text-sm text-slate-600">Check the Cloudflare Worker logs for the query scope and error details.</p>
          {error.digest ? <p className="mt-4 text-sm font-medium text-slate-700">Digest: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700"
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
