export async function tryCatch(promise) {
    try {
        const data = await promise;
        return { data, error: null };
    }
    catch (error) {
        return { data: null, error: error };
    }
}
export const numBool = (n) => {
    if (n === undefined || n === null) {
        throw Error("n is not a number. n=" + n);
    }
    return n !== 0;
};
export function isValidSeriesName(text) {
    // Checks for basic series name pattern: PREFIX@GEO.FREQ
    const seriesNamePattern = /^[A-Z0-9_&%$]+@[A-Z0-9_]+(\.[ASQMWD])?$/i;
    return seriesNamePattern.test(text);
}
export function formatTimestamp(timestampSeconds) {
    if (!timestampSeconds)
        return "Never";
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
export function formatValue(value, label) {
    if (value === null || value === undefined)
        return `${label}: N/A`;
    return `${label}: ${value}`;
}
