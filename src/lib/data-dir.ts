import "server-only";
import { resolve } from "node:path";

/**
 * Resolve the root data directory from the DATA_DIR environment variable.
 *
 * DATA_DIR must be set in the environment (e.g. via .env).
 * Centralised here so turbopack cannot statically trace a
 * fallback path literal into the project tree.
 */
export function getDataDir(): string {
  const dir = process.env.DATA_DIR;
  if (!dir) {
    throw new Error(
      "DATA_DIR environment variable is not set. " +
        'Add DATA_DIR to your .env file (e.g. DATA_DIR="./data").',
    );
  }
  return resolve(dir);
}
