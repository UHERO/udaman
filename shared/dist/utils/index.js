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
