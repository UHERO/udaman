import type { Instrumentation } from "next";

// Ensure all server-side date operations use Hawaii Standard Time.
export function register() {
  process.env.TZ = "Pacific/Honolulu";
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  // Dynamic import avoids pulling pino into the edge runtime at build time.
  import("@/core/observability/logger").then(({ logger }) => {
    logger.error(
      {
        name: "request-error",
        digest: (error as Error & { digest?: string }).digest,
        method: request.method,
        path: request.path,
        headers: Object.fromEntries(
          Object.entries(request.headers).filter(
            ([k]) => !k.startsWith("cookie") && !k.startsWith("authorization"),
          ),
        ),
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
      },
      `[${request.method}] ${request.path}: ${(error as Error).message}`,
    );
  });
};
