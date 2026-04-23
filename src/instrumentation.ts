import type { Instrumentation } from "next";

// Ensure all server-side date operations use Hawaii Standard Time.
export function register() {
  process.env.TZ = "Pacific/Honolulu";
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // Dynamic imports avoid pulling pino/auth into the edge runtime at build time.
  const [{ logger }, { getSession }] = await Promise.all([
    import("@/core/observability/logger"),
    import("@/lib/auth/dal"),
  ]);

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
};
