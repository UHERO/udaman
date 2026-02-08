/**
 * @udaman/observability — structured JSON logging powered by pino.
 *
 * Pino is a structured JSON logger for Node/Bun. Every log
 * entry is a single JSON line, which makes logs easy to parse, search, and pipe
 * into observability tools.
 *
 * ## Log levels (lowest → highest priority)
 *
 *   Level   │ Value │ Method          │ When to use
 *   ────────┼───────┼─────────────────┼──────────────────────────────────────
 *   trace   │  10   │ log.trace(...)  │ Very granular debugging (loop iterations, variable dumps)
 *   debug   │  20   │ log.debug(...)  │ Diagnostic info useful during development
 *   info    │  30   │ log.info(...)   │ Normal operational events (startup, request served)
 *   warn    │  40   │ log.warn(...)   │ Unexpected but recoverable situations
 *   error   │  50   │ log.error(...)  │ Failures that need attention
 *   fatal   │  60   │ log.fatal(...)  │ Unrecoverable errors — usually followed by process exit
 *
 * Setting a level silences everything below it. The default here is "info", so
 * trace/debug messages are hidden unless you set `LOG_LEVEL=debug` (or lower).
 *
 * ## Structured data
 * Pass an object as the first argument to attach fields to the JSON entry:
 *
 *   log.info({ userId: 42, action: "checkout" }, "order placed");
 *   => {"level":30,"time":"...","name":"catalog","userId":42,"action":"checkout","msg":"order placed"}
 *
 * ## Useful pino options (can be added to the root logger below)
 *
 *   - `redact: ["req.headers.authorization"]`
 *       Scrub sensitive paths from log output.
 *
 *   - `transport: { target: "pino-pretty" }`
 *       Human-readable, colorized output for local development.
 *       Install pino-pretty as a devDependency first.
 *
 *   - `serializers: { err: pino.stdSerializers.err }`
 *       Normalize Error objects into { type, message, stack } automatically.
 *
 *   - `base: { pid: false, hostname: false }`
 *       Strip default pid/hostname fields to reduce noise (useful in containers
 *       where this metadata comes from the platform).
 *
 * @see https://getpino.io — full documentation
 */
import pino from "pino";

/**
 * Root pino logger instance.
 *
 * Defaults to `"info"` level — override at runtime with the `LOG_LEVEL`
 * environment variable (e.g. `LOG_LEVEL=debug`).
 *
 * Prefer {@link createLogger} so each service/package is identifiable in logs.
 * Use the root logger only for process-level concerns (startup, shutdown, etc.).
 *
 * For pretty-printed output in development, pipe through pino-pretty:
 *   bun dev | pino-pretty
 *
 * ```ts
 * import { logger } from "@udaman/observability/logger";
 * logger.info("server listening on port 3000");
 * ```
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a named child logger.
 *
 * Each child inherits the root logger's configuration and appends a `name`
 * field to every log entry, making it easy to filter logs by source.
 *
 * @param name - Identifier for the package or service (e.g. `"catalog"`, `"rest-api"`).
 * @returns A pino child logger bound with `{ name }`.
 *
 * ```ts
 * import { createLogger } from "@udaman/observability/logger";
 *
 * const log = createLogger("catalog");
 * log.info("hello");
 * // => {"level":30,"time":"2026-02-07T...","name":"catalog","msg":"hello"}
 * ```
 */
function createLogger(name: string) {
  return logger.child({ name });
}

export { logger, createLogger };
