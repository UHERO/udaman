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
"[project]/udaman/dashboard/.next-internal/server/app/(udaman)/series/[id]/page/actions.js { ACTIONS_MODULE0 => \"[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
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
"[project]/udaman/dashboard/.next-internal/server/app/(udaman)/series/[id]/page/actions.js { ACTIONS_MODULE0 => \"[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f2e$next$2d$internal$2f$server$2f$app$2f28$udaman$292f$series$2f5b$id$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$action$2d$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/udaman/dashboard/.next-internal/server/app/(udaman)/series/[id]/page/actions.js { ACTIONS_MODULE0 => "[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/udaman/dashboard/lib/action-utils.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
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
"[project]/udaman/shared/utils/time.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dpAgeCode",
    ()=>dpAgeCode,
    "formatRuntime",
    ()=>formatRuntime,
    "generateDates",
    ()=>generateDates,
    "uheroDate",
    ()=>uheroDate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addMonths$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/addMonths.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addQuarters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/addQuarters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addYears$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/addYears.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/differenceInDays.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/format.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/isAfter.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/startOfMonth.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfQuarter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/startOfQuarter.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfYear$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/startOfYear.js [app-rsc] (ecmascript)");
;
/* Functions for generating date lists for use in tables, charts, etc. Initially used in CPI-RPP portal */ function generateDates(startDate, endDate, frequency, formatString) {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("generateDates: invalid dates passed as arguments");
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAfter"])(startDate, endDate)) {
        throw new Error("generateDates: startDate must be before or equal to endDate");
    }
    switch(frequency){
        case "M":
            return generateMonths(startDate, endDate, formatString);
        case "Q":
            return generateQuarters(startDate, endDate, formatString);
        case "A":
            return generateYears(startDate, endDate, formatString);
        default:
            return generateMonths(startDate, endDate, formatString);
    }
}
function generateMonths(startDate, endDate, formatString = "yyyy-MM") {
    const months = [];
    let current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfMonth"])(startDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfMonth"])(endDate);
    while(!(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAfter"])(current, end)){
        months.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(current, formatString));
        current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addMonths$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addMonths"])(current, 1);
    }
    return months;
}
function generateQuarters(startDate, endDate, formatString = "yyyy-'Q'Q") {
    const quarters = [];
    let current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfQuarter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfQuarter"])(startDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfQuarter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfQuarter"])(endDate);
    while(!(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAfter"])(current, end)){
        quarters.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(current, formatString));
        current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addQuarters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addQuarters"])(current, 1);
    }
    return quarters;
}
function generateYears(startDate, endDate, formatString = "yyyy") {
    const years = [];
    let current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfYear$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfYear"])(startDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfYear$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfYear"])(endDate);
    while(!(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAfter"])(current, end)){
        years.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(current, formatString));
        current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addYears$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addYears"])(current, 1);
    }
    return years;
}
/** Try to keep display formats consistent across all systems */ const uheroDate = (date, freq)=>{
    switch(freq){
        case "M":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "MMM yyyy");
        case "Q":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy QQQ");
        case "A":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy");
        default:
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy-MM-dd");
    }
};
/** Generates the age field in series table. Taken from JP's ruby version. Unsure why
 * they settled on the 100 day and 10 month intervals.
 */ function dpAgeCode(updatedAt, pseudoHistory) {
    console.log("updatedAt", updatedAt);
    const now = new Date();
    const createdAt = new Date(updatedAt);
    const days = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["differenceInDays"])(now, createdAt);
    const months = Math.round(days / 30.0);
    const prefix = pseudoHistory ? "*" : "";
    let ageCode;
    if (days < 100) {
        ageCode = days.toString().padStart(2, "0");
    } else if (months < 10) {
        ageCode = `${months}m`;
    } else {
        let years = days / 365.0;
        years = years % 1 < 0.8 ? Math.floor(years) : Math.floor(years) + 1;
        years = years === 0 ? 1 : years;
        ageCode = `${years}y`;
    }
    return prefix + ageCode;
}
function formatRuntime(runtimeSeconds) {
    if (runtimeSeconds === null) return "-";
    return `${runtimeSeconds.toFixed(2)}s`;
}
;
}),
"[project]/udaman/dashboard/components/series/data-loader.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoaderSection",
    ()=>LoaderSection
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/client/app-dir/link.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/shared/utils/time.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/format.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/lucide-react/dist/esm/icons/clock.js [app-rsc] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
const LoaderSection = ({ seriesId, loaders })=>{
    const actions1 = [
        {
            action: "load",
            url: "#"
        },
        {
            action: "clear",
            url: "#"
        },
        {
            action: "delete",
            url: "#"
        },
        {
            action: "disable",
            url: "#"
        },
        {
            action: "edit",
            url: "#"
        },
        {
            action: "toggle nightly load",
            url: "#"
        }
    ];
    const bulkActions = [
        {
            action: "new",
            url: "#"
        },
        {
            action: "clear data",
            url: "#"
        },
        {
            action: "load all",
            url: "#"
        }
    ];
    console.log("LoaderSection", loaders);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col border-b",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-row justify-start border-b font-semibold",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "mr-4",
                        children: "Loaders"
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    "(",
                    bulkActions.map((m, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    href: m.url,
                                    className: "px-2",
                                    children: m.action
                                }, void 0, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                    lineNumber: 37,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                i !== bulkActions.length - 1 ? "|" : ""
                            ]
                        }, `bulk-action-${i}`, true, {
                            fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                            lineNumber: 36,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))),
                    ")"
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                lineNumber: 33,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            loaders.map((l, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(LoaderItem, {
                    loader: l
                }, `data-loader-${i}`, false, {
                    fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                    lineNumber: 46,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)))
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
const LoaderItem = ({ loader })=>{
    const lastRunDate = loader.last_run_at !== null ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(loader.last_run_at, "mm/dd/yy") : "-";
    const lastRunTime = loader.last_run_at !== null ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(loader.last_run_at, "HH:MM") : "-";
    const runtime = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$time$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatRuntime"])(loader.runtime);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("p-2", getColor(loader.color)),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-row items-center justify-evenly",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-left text-xs font-light",
                                children: lastRunDate
                            }, void 0, false, {
                                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                lineNumber: 63,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-primary/80 text-xs",
                                children: lastRunTime
                            }, void 0, false, {
                                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                lineNumber: 64,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-primary/80 text-sm",
                        children: [
                            "(",
                            loader.priority,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 66,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    actions.map((m, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    href: m.url,
                                    className: "text-sm",
                                    children: m.action
                                }, void 0, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                    lineNumber: 69,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                i !== actions.length - 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-sm",
                                    children: "|"
                                }, void 0, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                    lineNumber: 72,
                                    columnNumber: 41
                                }, ("TURBOPACK compile-time value", void 0)) : ""
                            ]
                        }, `load-stmt-action-${i}`, true, {
                            fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                            lineNumber: 68,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)))
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                lineNumber: 61,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "my-3 flex py-2 font-semibold",
                        children: [
                            loader.id,
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                className: "ml-2 p-0.5"
                            }, void 0, false, {
                                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                lineNumber: 78,
                                columnNumber: 23
                            }, ("TURBOPACK compile-time value", void 0)),
                            " "
                        ]
                    }, void 0, true, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 77,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "w-18 text-left text-xs font-light tracking-tighter",
                        children: [
                            "(",
                            runtime,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-semibold",
                                children: "Scale:"
                            }, void 0, false, {
                                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                                lineNumber: 85,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            " ",
                            loader.scale
                        ]
                    }, void 0, true, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 84,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                lineNumber: 76,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs",
                        children: loader.description
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 90,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs",
                        children: loader.eval
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
                lineNumber: 89,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/components/series/data-loader.tsx",
        lineNumber: 60,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
/* Tailwind requires colors be named somewhere in the codebase in order to use so using
this implementation to get started, may switch to using hex codes as keys to tailwind 
colors for better colors. */ const getColor = (color)=>{
    if (color === null) return "bg-muted";
    const colors = {
        // Purples
        B2A1EA: "bg-[#B2A1EA]",
        CDC8FE: "bg-[#CDC8FE]",
        A885EF: "bg-[#A885EF]",
        // Oranges
        FFA94E: "bg-[#FFA94E]",
        FFA500: "bg-[#FFA500]",
        // blues
        A9BEF2: "bg-[#A9BEF2]",
        C3DDF9: "bg-[#C3DDF9]",
        "6495ED": "bg-[#6495ED]",
        // yellow
        F9FF8B: "bg-[#F9FF8B]",
        FBFFBD: "bg-[#FBFFBD]",
        F0E67F: "bg-[#F0E67F]",
        // browns
        CAAF8C: "bg-[#CAAF8C]",
        DFC3AA: "bg-[#DFC3AA]",
        B78E5C: "bg-[#B78E5C]",
        // salmon:
        FEB4AA: "bg-[#FEB4AA]",
        // greens:
        "9FDD8C": "bg-[#9FDD8C]",
        D0F0C0: "bg-[#D0F0C0]",
        "88D3B2": "bg-[#88D3B2]",
        "74C365": "bg-[#74C365]"
    };
    return colors[color];
};
}),
"[project]/udaman/dashboard/components/series/tables.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "MetaDataTable",
    ()=>MetaDataTable,
    "SeriesDataTable",
    ()=>SeriesDataTable,
    "SeriesSummaryTable",
    ()=>SeriesSummaryTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const MetaDataTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call MetaDataTable() from the server but MetaDataTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/tables.tsx <module evaluation>", "MetaDataTable");
const SeriesDataTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SeriesDataTable() from the server but SeriesDataTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/tables.tsx <module evaluation>", "SeriesDataTable");
const SeriesSummaryTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SeriesSummaryTable() from the server but SeriesSummaryTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/tables.tsx <module evaluation>", "SeriesSummaryTable");
}),
"[project]/udaman/dashboard/components/series/tables.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "MetaDataTable",
    ()=>MetaDataTable,
    "SeriesDataTable",
    ()=>SeriesDataTable,
    "SeriesSummaryTable",
    ()=>SeriesSummaryTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const MetaDataTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call MetaDataTable() from the server but MetaDataTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/tables.tsx", "MetaDataTable");
const SeriesDataTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SeriesDataTable() from the server but SeriesDataTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/tables.tsx", "SeriesDataTable");
const SeriesSummaryTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SeriesSummaryTable() from the server but SeriesSummaryTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/tables.tsx", "SeriesSummaryTable");
}),
"[project]/udaman/dashboard/components/series/tables.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$tables$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/tables.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$tables$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/tables.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$tables$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SeriesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$data$2d$loader$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/data-loader.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$tables$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/tables.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
async function SeriesPage({ params }) {
    const { id } = await params;
    const { error, data } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSeriesById"])(id);
    if (error) throw error;
    if (!data) (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    const { dataPoints, metadata, measurement, aliases, loaders } = data;
    console.log("Data Points", dataPoints);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid grid-cols-12 gap-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "col-span-1 rounded"
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                lineNumber: 66,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "col-span-6 rounded",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$data$2d$loader$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["LoaderSection"], {
                            seriesId: id,
                            loaders: loaders
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                            lineNumber: 69,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$tables$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SeriesDataTable"], {
                            data: dataPoints
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                            lineNumber: 70,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                    lineNumber: 68,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "col-span-4 rounded",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$tables$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MetaDataTable"], {
                    metadata: {
                        ...metadata,
                        measurement,
                        aliases
                    }
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                    lineNumber: 74,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
                lineNumber: 73,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx",
        lineNumber: 65,
        columnNumber: 5
    }, this);
} /* Metadata
{
   id: 400625,
   xseries_id: 400625,
   geography_id: 6378,
   unit_id: 6477,
   source_id: 7576,
   source_detail_id: null,
   universe: 'NTA',
   decimals: 2,
   name: 'NTA_LSR@CPV.A',
   dataPortalName: 'Longitudinal support ratio',
   description: null,
   created_at: '2023-12-01T17:45:17.000Z',
   updated_at: '2023-12-01T17:45:17.000Z',
   dependency_depth: 0,
   source_link: null,
   investigation_notes: null,
   scratch: 0,
   primary_series_id: 405962,
   restricted: 0,
   quarantined: 0,
   frequency: 'year',
   seasonally_adjusted: null,
   seasonal_adjustment: 'not_applicable',
   aremos_missing: null,
   aremos_diff: null,
   mult: null,
   units: 1,
   percent: 0,
   real: null,
   base_year: null,
   frequency_transform: null,
   last_demetra_date: null,
   last_demetra_datestring: null,
   factor_application: null,
   factors: null,
   geo_handle: 'CPV',
   geo_display_name: 'Cabo Verde',
   unit_short: 'Percent',
   unit_long: 'Percent',
   source_description: 'Longitudinal support ratio (Mason, Lee et al. 2017)',
   source_detail_description: null
  
   Data Source (loader)
    id
    series_id
    disabled
    universe
    priority
    created_at
    updated_at
    reload_nightly
    pseudo_history
    clear_before_load
    eval
    scale
    presave_hook
    color
    runtime
    last_run_at
    last_run_in_seconds
    last_error
    last_error_at
    dependencies
    description
} */ 
}),
"[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/udaman/dashboard/app/(udaman)/series/[id]/page.tsx [app-rsc] (ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__fc763104._.js.map