type Success<T> = {
    data: T;
    error: null;
};
type Failure<E> = {
    data: null;
    error: E;
};
type Result<T, E = Error> = Success<T> | Failure<E>;
export declare function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>>;
/** Because mysql stores booleans as 0 (false) and 1 (true).
 * Guess I could alter this in the model, but I'd have to
 * overwrite the imputed prisma schema type  */
export declare const numBool: (n: number | null | undefined | boolean) => boolean;
export declare function isValidSeriesName(text: string): boolean;
export declare function formatTimestamp(timestampSeconds: number): string;
export declare function formatValue(value: number | null | undefined, label: string): string;
export {};
//# sourceMappingURL=index.d.ts.map