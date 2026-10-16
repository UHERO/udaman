/**
 * Which deployment this process belongs to. The single source of truth for
 * "are we in production?" — read `APP_ENV`, never `NODE_ENV`, for that.
 *
 * NODE_ENV only says how the code was built: staging runs a production build
 * (NODE_ENV=production) but must not send real mail, fire crons, or post to
 * the comms Slack channel.
 *
 * Server-only: `APP_ENV` is not a NEXT_PUBLIC_ var, so in client code it is
 * undefined. Pass the value down from a server component if a client needs it.
 */

export type AppEnv = "local" | "staging" | "production";

const APP_ENVS: readonly AppEnv[] = ["local", "staging", "production"];

function readAppEnv(): AppEnv {
  const raw = process.env.APP_ENV?.trim();
  if (!raw) {
    // A production build with no APP_ENV is a misconfigured server. Fail
    // loudly rather than silently behaving like local (no crons, mail
    // redirected).
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `APP_ENV must be set for production builds (one of: ${APP_ENVS.join(", ")})`,
      );
    }
    return "local";
  }
  if (!(APP_ENVS as readonly string[]).includes(raw)) {
    throw new Error(
      `Invalid APP_ENV "${raw}" (expected one of: ${APP_ENVS.join(", ")})`,
    );
  }
  return raw as AppEnv;
}

export const APP_ENV: AppEnv = readAppEnv();
export const isProduction = APP_ENV === "production";
