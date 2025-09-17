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
export declare const numBool: (n: number | null | undefined) => boolean;
export declare function isValidSeriesName(text: string): boolean;
export declare function formatTimestamp(timestampSeconds: number): string;
export declare function formatValue(value: number | null | undefined, label: string): string;
export {};
//# sourceMappingURL=index.d.ts.map