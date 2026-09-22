/**
 * Node-runtime half of `instrumentation.ts`. Loaded only behind a
 * `process.env.NEXT_RUNTIME === "nodejs"` check, which the bundler
 * resolves at build time — so the logger (fs/os/path/util) and the auth
 * DAL never enter the Edge bundle. A plain dynamic `import()` in
 * instrumentation.ts is not enough: the Edge compiler still traces it and
 * warns "A Node.js module is loaded ('path')".
 */
import type { Instrumentation } from "next";

import { AppLogCollection } from "@/core/catalog/collections/app-log-collection";
import { logger } from "@/core/observability/logger";
import { getSession } from "@/lib/auth/dal";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  let userId: string | undefined;
  let userEmail: string | undefined;
  try {
    const session = await getSession();
    userId = session?.user?.id;
    userEmail = session?.user?.email ?? undefined;
  } catch {
    // Auth may fail during the error handler — don't let it mask the real error.
  }

  logger.error(
    {
      name: "request-error",
      digest: (error as Error & { digest?: string }).digest,
      method: request.method,
      path: request.path,
      userId,
      userEmail,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
    `[${request.method}] ${request.path}: ${(error as Error).message}`,
  );

  // Also write to the app_logs table so these errors are visible on /admin/logs.
  try {
    AppLogCollection.log({
      level: "error",
      category: "request-error",
      name: `[${request.method}] ${context.routePath ?? request.path}`,
      userId: userId ? Number(userId) : undefined,
      metadata: {
        message: (error as Error).message,
        digest: (error as Error & { digest?: string }).digest,
        method: request.method,
        path: request.path,
        routerKind: context.routerKind,
        routeType: context.routeType,
        renderSource: context.renderSource,
      },
    });
  } catch {
    // Never let app_log writes mask the original error.
  }
};
