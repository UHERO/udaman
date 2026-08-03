/**
 * Structured logger built on Pino.
 *
 * Outputs JSON to stdout — no pino-pretty in production.
 * Use `createLogger(name)` to get a named child logger.
 */

import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

const appEventLog = pino(
  { level: "info" },
  pino.destination({ dest: "./logs/app-events.log", mkdir: true, sync: false }),
);

/**
 * Named child logger. Extra `bindings` are attached to every line — worker
 * processes pass `workerBindings()` so multi-machine logs identify themselves.
 */
function createLogger(name: string, bindings?: Record<string, unknown>) {
  return logger.child({ name, ...bindings });
}

type Logger = ReturnType<typeof createLogger>;

export { logger, createLogger, appEventLog };
export type { Logger };
