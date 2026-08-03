import os from "os";

/**
 * Identity of the current worker process.
 *
 * Several machines run the same worker code against one shared database, so
 * anything a worker writes — a log line, a heartbeat row, an error stored on
 * scrape_status — is ambiguous unless it says which machine produced it.
 *
 * os.hostname() is NOT stable on macOS: with `HostName` unset (the default),
 * the OS derives the running hostname from DHCP/reverse-DNS, so the same
 * machine reports 's200n209.soc.hawaii.edu' on one network and 'Kaisers.local'
 * on another — and a new DHCP lease can change it again. Anything keyed on the
 * name (the heartbeat row) then registers the machine under several identities
 * and leaves orphans behind.
 *
 * Set WORKER_NAME in each machine's .env to pin it. Hostname is only a fallback.
 */

export const OS_HOSTNAME = os.hostname();

/** True when WORKER_NAME is pinned; false means we fell back to the hostname. */
export const WORKER_NAME_IS_PINNED = Boolean(process.env.WORKER_NAME?.trim());

export const WORKER_NAME = process.env.WORKER_NAME?.trim() || OS_HOSTNAME;

export const WORKER_PID = process.pid;

/** Unique per running process — one machine may run more than one worker. */
export const WORKER_ID = `${WORKER_NAME}:${WORKER_PID}`;

/** Bindings to attach to a logger so every line names its machine. */
export function workerBindings(): Record<string, string | number> {
  return { worker: WORKER_NAME, host: OS_HOSTNAME, pid: WORKER_PID };
}

/**
 * Tag a message with the worker that produced it.
 *
 * For text that lands somewhere without structured fields — chiefly
 * scrape_status.error, which the dashboard renders verbatim — so a failure
 * read off the dashboard points at a machine.
 */
export function tagWithWorker(message: string): string {
  return `[${WORKER_NAME}] ${message}`;
}
