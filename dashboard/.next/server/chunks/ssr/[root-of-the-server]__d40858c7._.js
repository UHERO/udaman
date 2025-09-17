module.exports = [
"[project]/udaman/dashboard/lib/types.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createActionResult",
    ()=>createActionResult
]);
const createActionResult = {
    success: (data)=>({
            error: null,
            data
        }),
    error: (error, statusCode)=>({
            error,
            data: null,
            statusCode
        })
};
}),
"[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"407e64a257b0bea183b550c12178e1be47be27e200":"withErrorHandling","6007855f4aaf71eccf29dd5056ef7b747977cc4606":"apiRequest"},"",""] */ __turbopack_context__.s([
    "apiRequest",
    ()=>apiRequest,
    "withErrorHandling",
    ()=>withErrorHandling
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/types.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function withErrorHandling(action) {
    try {
        const result = await action();
        return __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createActionResult"].success(result);
    } catch (error) {
        console.error("Server action error:", error);
        // Can add error types more as needed
        if (error instanceof Error) {
            if (error.message.includes("404")) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createActionResult"].error("Resource not found", 404);
            }
            if (error.message.includes("400")) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createActionResult"].error(error.message, 400);
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createActionResult"].error("Something went wrong. Please try again later.");
    }
}
async function apiRequest(endpoint, options) {
    const response = await fetch(`${process.env.API_BASE_URL || "http://127.0.0.1:3001"}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        ...options
    });
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.error?.message || "API request failed");
        error.name = `${response.status}`;
        throw error;
    }
    return data;
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    withErrorHandling,
    apiRequest
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(withErrorHandling, "407e64a257b0bea183b550c12178e1be47be27e200", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(apiRequest, "6007855f4aaf71eccf29dd5056ef7b747977cc4606", null);
}),
"[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"00daf7f8e5e08116e53170ae0e1bc699ae6b1aa9ee":"getSeries","4054ab57a26841b7235b68e5b6ba4ca77c523100e2":"createSeries","40a253856b9a2c01be05307e447371b3d7e0c466ad":"getSeriesById"},"",""] */ __turbopack_context__.s([
    "createSeries",
    ()=>createSeries,
    "getSeries",
    ()=>getSeries,
    "getSeriesById",
    ()=>getSeriesById
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
async function getSeries() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withErrorHandling"])(async ()=>{
        const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["apiRequest"])("/series");
        return response.data;
    });
}
async function getSeriesById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withErrorHandling"])(async ()=>{
        const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["apiRequest"])(`/series/${id}`);
        return response.data;
    });
}
async function createSeries(formData) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withErrorHandling"])(async ()=>{
        const seriesData = {
            name: formData.get("name"),
            dataPortalName: formData.get("dataPortalName")
        };
        const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["apiRequest"])("/series", {
            method: "POST",
            body: JSON.stringify(seriesData)
        });
        return response.data;
    });
} // export async function getSeriesSummaries() {
 //   // SELECT `xseries`.* FROM `xseries` WHERE `xseries`.`id` = ? LIMIT ?  [["id", 405962], ["LIMIT", 1]]
 // }
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getSeries,
    getSeriesById,
    createSeries
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getSeries, "00daf7f8e5e08116e53170ae0e1bc699ae6b1aa9ee", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getSeriesById, "40a253856b9a2c01be05307e447371b3d7e0c466ad", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createSeries, "4054ab57a26841b7235b68e5b6ba4ca77c523100e2", null);
}),
"[project]/udaman/dashboard/.next-internal/server/app/(udaman)/series/page/actions.js { ACTIONS_MODULE0 => \"[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)");
;
;
;
;
;
}),
"[project]/udaman/dashboard/.next-internal/server/app/(udaman)/series/page/actions.js { ACTIONS_MODULE0 => \"[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "00daf7f8e5e08116e53170ae0e1bc699ae6b1aa9ee",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSeries"],
    "4054ab57a26841b7235b68e5b6ba4ca77c523100e2",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createSeries"],
    "407e64a257b0bea183b550c12178e1be47be27e200",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withErrorHandling"],
    "40a253856b9a2c01be05307e447371b3d7e0c466ad",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSeriesById"],
    "6007855f4aaf71eccf29dd5056ef7b747977cc4606",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["apiRequest"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f2e$next$2d$internal$2f$server$2f$app$2f28$udaman$292f$series$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/udaman/dashboard/.next-internal/server/app/(udaman)/series/page/actions.js { ACTIONS_MODULE0 => "[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)");
}),
"[project]/udaman/dashboard/app/favicon.ico.mjs { IMAGE => \"[project]/udaman/dashboard/app/favicon.ico (static in ecmascript)\" } [app-rsc] (structured image object, ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/udaman/dashboard/app/favicon.ico.mjs { IMAGE => \"[project]/udaman/dashboard/app/favicon.ico (static in ecmascript)\" } [app-rsc] (structured image object, ecmascript)"));
}),
"[project]/udaman/dashboard/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/udaman/dashboard/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/udaman/dashboard/app/(udaman)/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/udaman/dashboard/app/(udaman)/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/udaman/dashboard/app/(udaman)/series/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__, module, exports) => {

const e = new Error("Could not parse module '[project]/udaman/dashboard/app/(udaman)/series/page.tsx'\n\nExpected '</', got 'data'");
e.code = 'MODULE_UNPARSABLE';
throw e;
}),
"[project]/udaman/dashboard/app/(udaman)/series/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/udaman/dashboard/app/(udaman)/series/page.tsx [app-rsc] (ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__d40858c7._.js.map