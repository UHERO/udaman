"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log error client-side; dynamic import avoids pulling in server action
  // module graph at build time, which breaks global-error prerender.
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
    <html>
      <body>
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
          }}
        >
          <h2>Something went wrong!</h2>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
