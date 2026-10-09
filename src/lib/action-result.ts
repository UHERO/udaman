import { toast } from "sonner";

/**
 * Result of a server action that can fail in a way the user should read.
 *
 * Next.js redacts thrown server-action error messages in production, so the
 * client would only ever toast a generic digest. Expected failures (not
 * allowed, invalid input, not found) come back as `ok: false` instead; truly
 * unexpected ones are still thrown so they surface and get logged as usual.
 *
 * `denied` marks a permission refusal — the user tried something that isn't
 * theirs to do, not something that broke — so it toasts as a warning.
 */
export type ActionResult<T> =
  ({ ok: true } & T) | { ok: false; error: string; denied?: boolean };

/** A failed action result, rethrown on the client. */
export class ActionError extends Error {
  readonly denied: boolean;
  constructor(message: string, denied = false) {
    super(message);
    this.name = "ActionError";
    this.denied = denied;
  }
}

/**
 * Client-side: turn an `ok: false` result back into a thrown ActionError, so
 * callers keep a single `catch` that hands off to toastActionError.
 */
export function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new ActionError(result.error, result.denied);
  return result;
}

/**
 * Toast a caught action failure: a yellow warning for a permission refusal,
 * a red error for anything else. `prefix` is prepended to the error's own
 * message, not to `fallback`.
 */
export function toastActionError(
  err: unknown,
  fallback: string,
  prefix = "",
): void {
  const message = err instanceof Error ? prefix + err.message : fallback;
  if (err instanceof ActionError && err.denied) toast.warning(message);
  else toast.error(message);
}
