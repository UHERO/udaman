"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Dynamic import avoids pulling in server action module graph at build time,
  // which breaks prerender (same pattern as global-error.tsx).
  if (typeof window !== "undefined") {
    import("@/actions/app-log").then(({ reportClientError }) => {
      reportClientError({
        message: error.message,
        digest: error.digest,
        pathname: window.location.pathname,
      });
    });
    console.error(error);
  }

  return (
    <main className="flex h-full flex-col items-center justify-center">
      <h2 className="text-center">Something went wrong!</h2>
      <button
        className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-400"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  );
}
