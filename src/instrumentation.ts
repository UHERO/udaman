import type { Instrumentation } from "next";

// Ensure all server-side date operations use Hawaii Standard Time.
export function register() {
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
