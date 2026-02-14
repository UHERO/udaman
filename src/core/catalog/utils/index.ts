// Types for the result object with discriminated union
type Success<T> = {
  data: T;
  error: null;
};

type Failure<E> = {
  data: null;
  error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}

/** Because mysql stores booleans as 0 (false) and 1 (true).
 * Guess I could alter this in the model, but I'd have to
 * overwrite the imputed prisma schema type  */
export const numBool = (n: number | null | undefined | boolean) => {
  if (typeof n === "boolean") return n;
  if (n === undefined || n === null) {
    throw Error("n is not a number. n=" + n);
  }
  return n !== 0;
};

export function isValidSeriesName(text: string): boolean {
  // Checks for basic series name pattern: PREFIX@GEO.FREQ
  const seriesNamePattern = /^[A-Z0-9_&%$]+@[A-Z0-9_]+(\.[ASQMWD])?$/i;
  return seriesNamePattern.test(text);
}

export function formatTimestamp(timestampSeconds: number): string {
  if (!timestampSeconds) return "Never";

  const date = new Date(timestampSeconds * 1000);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatValue(
  value: number | null | undefined,
  label: string,
): string {
  if (value === null || value === undefined) return `${label}: N/A`;
  return `${label}: ${value}`;
}
