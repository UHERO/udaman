/**
 * Lightweight structured logger built on console.
 *
 * Provides named child loggers with consistent formatting:
 *   [timestamp] LEVEL (name) message { ...data }
 *
 * Works in both server and browser contexts with zero dependencies.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const CONSOLE_FN: Record<Level, keyof Console> = { debug: "debug", info: "log", warn: "warn", error: "error" };
const MIN_LEVEL = (process.env.LOG_LEVEL ?? "info") as Level;

interface Logger {
  debug: (dataOrMsg: Record<string, unknown> | string, msg?: string) => void;
  info: (dataOrMsg: Record<string, unknown> | string, msg?: string) => void;
  warn: (dataOrMsg: Record<string, unknown> | string, msg?: string) => void;
  error: (dataOrMsg: Record<string, unknown> | string, msg?: string) => void;
  child: (bindings: { name: string }) => Logger;
}

function makeLogger(name?: string): Logger {
  function log(level: Level, dataOrMsg: Record<string, unknown> | string, msg?: string) {
    if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;

    const ts = new Date().toISOString();
    const tag = name ? ` (${name})` : "";
    const fn = CONSOLE_FN[level];

    if (typeof dataOrMsg === "string") {
      (console[fn] as (...args: unknown[]) => void)(
        `${ts} ${level.toUpperCase()}${tag} ${dataOrMsg}`,
      );
    } else {
      (console[fn] as (...args: unknown[]) => void)(
        `${ts} ${level.toUpperCase()}${tag} ${msg ?? ""}`,
        dataOrMsg,
      );
    }
  }

  return {
    debug: (dataOrMsg, msg?) => log("debug", dataOrMsg, msg),
    info: (dataOrMsg, msg?) => log("info", dataOrMsg, msg),
    warn: (dataOrMsg, msg?) => log("warn", dataOrMsg, msg),
    error: (dataOrMsg, msg?) => log("error", dataOrMsg, msg),
    child: ({ name: childName }) => makeLogger(childName),
  };
}

const logger = makeLogger();

function createLogger(name: string): Logger {
  return logger.child({ name });
}

export { logger, createLogger };
export type { Logger };
