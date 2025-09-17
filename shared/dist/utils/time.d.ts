declare function generateDates(startDate: Date, endDate: Date, frequency: string, // "M" | "Q" | "A"
formatString?: string): string[];
/** Try to keep display formats consistent across all systems */
declare const uheroDate: (date: Date, freq?: string) => string;
/** Generates the age field in series table. Taken from JP's ruby version. Unsure why
 * they settled on the 100 day and 10 month intervals.
 */
declare function dpAgeCode(updatedAt: string, pseudoHistory: boolean): string;
declare function formatRuntime(runtimeSeconds: number | null): string;
export { generateDates, uheroDate, dpAgeCode, formatRuntime };
//# sourceMappingURL=time.d.ts.map