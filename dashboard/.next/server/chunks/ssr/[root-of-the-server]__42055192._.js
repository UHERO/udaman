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
"[project]/udaman/dashboard/components/ui/badge.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Badge",
    ()=>Badge,
    "badgeVariants",
    ()=>badgeVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/@radix-ui/react-slot/dist/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/class-variance-authority/dist/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-rsc] (ecmascript)");
;
;
;
;
const badgeVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden", {
    variants: {
        variant: {
            default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
            secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
            destructive: "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground"
        }
    },
    defaultVariants: {
        variant: "default"
    }
});
function Badge({ className, variant, asChild = false, ...props }) {
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Slot"] : "span";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "badge",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])(badgeVariants({
            variant
        }), className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/badge.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
;
}),
"[project]/udaman/dashboard/components/series/series-summary-table.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "SeriesSummaryTable",
    ()=>SeriesSummaryTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const SeriesSummaryTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SeriesSummaryTable() from the server but SeriesSummaryTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/series-summary-table.tsx <module evaluation>", "SeriesSummaryTable");
}),
"[project]/udaman/dashboard/components/series/series-summary-table.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

// This file is generated by next-core EcmascriptClientReferenceModule.
__turbopack_context__.s([
    "SeriesSummaryTable",
    ()=>SeriesSummaryTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const SeriesSummaryTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SeriesSummaryTable() from the server but SeriesSummaryTable is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/udaman/dashboard/components/series/series-summary-table.tsx", "SeriesSummaryTable");
}),
"[project]/udaman/dashboard/components/series/series-summary-table.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$series$2d$summary$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/series-summary-table.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$series$2d$summary$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/series-summary-table.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$series$2d$summary$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/udaman/dashboard/app/(udaman)/series/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Page
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/client/app-dir/link.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/actions/series-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$copy$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardCopy$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/lucide-react/dist/esm/icons/clipboard-copy.js [app-rsc] (ecmascript) <export default as ClipboardCopy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$plus$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardPlus$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/lucide-react/dist/esm/icons/clipboard-plus.js [app-rsc] (ecmascript) <export default as ClipboardPlus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/ui/badge.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/ui/button.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$series$2d$summary$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/series/series-summary-table.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
async function Page() {
    const { error, data } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$actions$2f$series$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSeries"])();
    if (error) throw error;
    if (!data) (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    const count = data.length ?? 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-1 flex-col gap-4 p-4 pt-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid auto-rows-min gap-4 md:grid-cols-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(SeriesCard, {
                        count: count
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                        lineNumber: 18,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(TroubleCard, {}, void 0, false, {
                        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                        lineNumber: 19,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(CalculateCard, {}, void 0, false, {
                        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                        lineNumber: 20,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$series$2f$series$2d$summary$2d$table$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SeriesSummaryTable"], {
                    data: data
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 22,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
}
const SeriesCard = ({ count })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid aspect-video grid-rows-4 rounded-xl",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-5xl font-bold tracking-tight opacity-80",
                children: [
                    "Data Series: ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono",
                        children: count
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                        lineNumber: 32,
                        columnNumber: 20
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 31,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "justify-start",
                variant: "ghost",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "#",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$plus$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardPlus$3e$__["ClipboardPlus"], {}, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                            lineNumber: 36,
                            columnNumber: 9
                        }, ("TURBOPACK compile-time value", void 0)),
                        "Add to Clipboard"
                    ]
                }, void 0, true, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                    lineNumber: 35,
                    columnNumber: 7
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 34,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "justify-start",
                variant: "ghost",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "#",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$copy$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardCopy$3e$__["ClipboardCopy"], {}, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                            lineNumber: 42,
                            columnNumber: 9
                        }, ("TURBOPACK compile-time value", void 0)),
                        "Replace Clipboard"
                    ]
                }, void 0, true, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                    lineNumber: 41,
                    columnNumber: 7
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 40,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
        lineNumber: 30,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
const TroubleCard = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid aspect-video grid-rows-4 rounded-xl",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-3xl font-bold opacity-80",
                children: "Trouble"
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 51,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "justify-between",
                variant: "secondary",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "#",
                    children: [
                        "Missing Source ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                            children: "+20"
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                            lineNumber: 54,
                            columnNumber: 24
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                    lineNumber: 53,
                    columnNumber: 7
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 52,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "justify-between",
                variant: "secondary",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "#",
                    children: [
                        "Unrestricted Missing Source ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                            children: "+20"
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                            lineNumber: 59,
                            columnNumber: 37
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                    lineNumber: 58,
                    columnNumber: 7
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 57,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "justify-between",
                variant: "secondary",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "#",
                    children: [
                        "Quarantined ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Badge"], {
                            children: "+20"
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                            lineNumber: 64,
                            columnNumber: 21
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                    lineNumber: 63,
                    columnNumber: 7
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
                lineNumber: 62,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
        lineNumber: 50,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
const CalculateCard = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "aspect-video rounded-xl",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
            className: "text-3xl font-bold opacity-80",
            children: "Calculate"
        }, void 0, false, {
            fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
            lineNumber: 72,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/app/(udaman)/series/page.tsx",
        lineNumber: 71,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
}),
"[project]/udaman/dashboard/app/(udaman)/series/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/udaman/dashboard/app/(udaman)/series/page.tsx [app-rsc] (ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__42055192._.js.map