import type { Instrumentation } from "next";

export function register() {
  // The server half depends on Bun APIs (Bun SQL, Bun.file, Bun.spawn).
  // Fail at startup with a clear message instead of a module-resolution error
  // on the first request. Edge (proxy.ts) never runs on Bun, so skip it there.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.versions.bun) {
    throw new Error(
      `udaman must run under Bun (use \`bun run dev\` / \`bun --bun next ...\`); ` +
        `got Node ${process.version}`,
    );
  }

  // Ensure all server-side date operations use Hawaii Standard Time.
  process.env.TZ = "Pacific/Honolulu";
}

/**
 * This file is compiled for both the Node and Edge runtimes. Everything
 * that touches Node built-ins (the logger, the auth DAL, MySQL) lives in
 * `instrumentation-node.ts` and is imported only inside the runtime check
 * below, which the bundler evaluates at build time and drops from the Edge
 * bundle. Edge request errors are still surfaced by Next itself.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { onRequestError: handle } = await import("./instrumentation-node");
    await handle(error, request, context);
  }
};
