/**
 * Structured logger — JSON lines to stdout.
 *
 * Writes are synchronous (writeSync on fd 1) so nothing is buffered when a
 * process exits. That is the whole point of not using pino here: pino's
 * default destination is an async sonic-boom stream, and `process.exit()` in
 * an error handler discards whatever it hasn't flushed. The qpub CLI hit
 * exactly that — a crash inside `parcel-list --execute` surfaced as
 * "sonic boom is not ready yet" with the real exception lost, which is how two
 * commands appeared to run cleanly while writing nothing.
 *
 * The line shape is unchanged from pino, because it is parsed downstream:
 * `parseServerLog` in components/admin/logs-panel.tsx keys off the numeric
 * `level` and the epoch-ms `time`.
 *
 *   {"level":30,"time":1786758735240,"pid":52645,"hostname":"canoes",
 *    "name":"qpub-cli","msg":"..."}
 */

import { appendFileSync, mkdirSync, writeSync } from "fs";
import { hostname as osHostname } from "os";
import path from "path";
import { format } from "util";

// ─── Levels ─────────────────────────────────────────────────────────

/** Pino's numeric levels — downstream parsers compare against these. */
const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Infinity,
} as const;

export type LevelName = keyof typeof LEVELS;

const METHODS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const satisfies readonly Exclude<LevelName, "silent">[];

function thresholdFor(name: string | undefined): number {
  const key = (name ?? "info").toLowerCase();
  return key in LEVELS ? LEVELS[key as LevelName] : LEVELS.info;
}

// ─── Serialization ──────────────────────────────────────────────────

const PID = process.pid;
const HOSTNAME = osHostname();

/**
 * JSON.stringify replacer that survives what real log payloads contain.
 *
 * Errors are the important case: `JSON.stringify(new Error("boom"))` is `{}`,
 * so a bare `log.error({ err }, "...")` would throw away the only thing worth
 * logging. BigInt (which the MySQL driver returns for COUNT) throws outright.
 */
function safeReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();

  return function (this: unknown, _key: string, value: unknown) {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Error) {
      return { type: value.name, message: value.message, stack: value.stack };
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

function serialize(line: Record<string, unknown>): string {
  try {
    return JSON.stringify(line, safeReplacer()) + "\n";
  } catch {
    // Never let a log line take the process down.
    return (
      JSON.stringify({
        level: line.level,
        time: line.time,
        pid: PID,
        hostname: HOSTNAME,
        msg: String(line.msg ?? ""),
        serializeError: true,
      }) + "\n"
    );
  }
}

/** Write without throwing — a broken pipe must not kill a worker. */
function writeLine(fd: number, text: string): void {
  try {
    writeSync(fd, text);
  } catch {
    /* EPIPE / EAGAIN — nothing useful to do from inside the logger */
  }
}

// ─── Logger ─────────────────────────────────────────────────────────

type LogFn = {
  (obj: Record<string, unknown>, msg?: string): void;
  /** Printf-style, as pino allows: `log.info("removed %d rows", n)`. */
  (msg: string, ...args: unknown[]): void;
};

export type Logger = { [K in (typeof METHODS)[number]]: LogFn } & {
  child(bindings: Record<string, unknown>): Logger;
  readonly level: string;
};

function makeLogger(
  bindings: Record<string, unknown>,
  levelName: string,
  sink: (text: string) => void,
): Logger {
  const threshold = thresholdFor(levelName);

  const emit = (
    level: number,
    a: Record<string, unknown> | string,
    b?: unknown,
    rest: unknown[] = [],
  ) => {
    if (level < threshold) return;

    // Two shapes, both pino's: (obj, msg) and (msg, ...printfArgs). util.format
    // matches what pino does with %s/%d/%j and leaves a plain string untouched.
    const [payload, msg] =
      typeof a === "string"
        ? [undefined, b === undefined ? a : format(a, b, ...rest)]
        : [a, b as string | undefined];

    sink(
      serialize({
        level,
        time: Date.now(),
        pid: PID,
        hostname: HOSTNAME,
        ...bindings,
        ...payload,
        ...(msg === undefined ? {} : { msg }),
      }),
    );
  };

  const logger = {
    child: (extra: Record<string, unknown>) =>
      makeLogger({ ...bindings, ...extra }, levelName, sink),
    level: levelName,
  } as Logger;

  for (const method of METHODS) {
    (logger as Record<string, unknown>)[method] = ((
      a: Record<string, unknown> | string,
      b?: unknown,
      ...rest: unknown[]
    ) => emit(LEVELS[method], a, b, rest)) as LogFn;
  }

  return logger;
}

const LEVEL_NAME = process.env.LOG_LEVEL ?? "info";

const logger = makeLogger({}, LEVEL_NAME, (text) => writeLine(1, text));

/**
 * Named child logger. Extra `bindings` are attached to every line — worker
 * processes pass `workerBindings()` so multi-machine logs identify themselves.
 */
function createLogger(name: string, bindings?: Record<string, unknown>) {
  return logger.child({ name, ...bindings });
}

// ─── App-event file log ─────────────────────────────────────────────

const APP_EVENT_LOG = path.resolve("./logs/app-events.log");
let appEventDirReady = false;

/**
 * Appends to logs/app-events.log, creating the directory on first use.
 *
 * Deliberately lazy: the previous implementation opened an async stream at
 * module load, so an unwritable directory became an import-time failure in
 * every process that touched the logger, CLI included.
 */
function appendAppEvent(text: string): void {
  try {
    if (!appEventDirReady) {
      mkdirSync(path.dirname(APP_EVENT_LOG), { recursive: true });
      appEventDirReady = true;
    }
    appendFileSync(APP_EVENT_LOG, text);
  } catch {
    /* app events are best-effort — never surface as an application error */
  }
}

const appEventLog = makeLogger({}, "info", appendAppEvent);

export { logger, createLogger, appEventLog, LEVELS };
