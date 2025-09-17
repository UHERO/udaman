(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/udaman/shared/utils/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Types for the result object with discriminated union
__turbopack_context__.s([
    "formatTimestamp",
    ()=>formatTimestamp,
    "formatValue",
    ()=>formatValue,
    "isValidSeriesName",
    ()=>isValidSeriesName,
    "numBool",
    ()=>numBool,
    "tryCatch",
    ()=>tryCatch
]);
async function tryCatch(promise) {
    try {
        const data = await promise;
        return {
            data,
            error: null
        };
    } catch (error) {
        return {
            data: null,
            error: error
        };
    }
}
const numBool = (n)=>{
    if (n === undefined || n === null) {
        throw Error("n is not a number. n=" + n);
    }
    return n !== 0;
};
function isValidSeriesName(text) {
    // Checks for basic series name pattern: PREFIX@GEO.FREQ
    const seriesNamePattern = /^[A-Z0-9_&%$]+@[A-Z0-9_]+(\.[ASQMWD])?$/i;
    return seriesNamePattern.test(text);
}
function formatTimestamp(timestampSeconds) {
    if (!timestampSeconds) return "Never";
    const date = new Date(timestampSeconds * 1000);
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });
}
function formatValue(value, label) {
    if (value === null || value === undefined) return "".concat(label, ": N/A");
    return "".concat(label, ": ").concat(value);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/udaman/dashboard/components/common.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SAIndicator",
    ()=>SAIndicator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-client] (ecmascript)");
;
;
const SAIndicator = (param)=>{
    let { sa, className, ...props } = param;
    if (sa === null) sa = "not_applicable";
    const saMap = {
        not_seasonally_adjusted: "NS",
        seasonally_adjusted: "SA",
        not_applicable: "NA"
    };
    const saVariant = {
        seasonally_adjusted: "text-green-600",
        not_seasonally_adjusted: "text-orange-600",
        not_applicable: "text-primary"
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(saVariant[sa], className),
        ...props,
        children: saMap[sa]
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/common.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = SAIndicator;
var _c;
__turbopack_context__.k.register(_c, "SAIndicator");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/udaman/dashboard/components/ui/table.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Table",
    ()=>Table,
    "TableBody",
    ()=>TableBody,
    "TableCaption",
    ()=>TableCaption,
    "TableCell",
    ()=>TableCell,
    "TableFooter",
    ()=>TableFooter,
    "TableHead",
    ()=>TableHead,
    "TableHeader",
    ()=>TableHeader,
    "TableRow",
    ()=>TableRow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
function Table(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "table-container",
        className: "relative w-full overflow-x-auto",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
            "data-slot": "table",
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("w-full caption-bottom text-sm", className),
            ...props
        }, void 0, false, {
            fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
            lineNumber: 13,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 9,
        columnNumber: 5
    }, this);
}
_c = Table;
function TableHeader(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
        "data-slot": "table-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("[&_tr]:border-b", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, this);
}
_c1 = TableHeader;
function TableBody(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
        "data-slot": "table-body",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("[&_tr:last-child]:border-0", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
_c2 = TableBody;
function TableFooter(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tfoot", {
        "data-slot": "table-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 44,
        columnNumber: 5
    }, this);
}
_c3 = TableFooter;
function TableRow(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
        "data-slot": "table-row",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 57,
        columnNumber: 5
    }, this);
}
_c4 = TableRow;
function TableHead(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
        "data-slot": "table-head",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-foreground h-10 px-2 text-left align-middle font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 70,
        columnNumber: 5
    }, this);
}
_c5 = TableHead;
function TableCell(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
        "data-slot": "table-cell",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("max-w-80 truncate px-2 py-1 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_c6 = TableCell;
function TableCaption(param) {
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("caption", {
        "data-slot": "table-caption",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-muted-foreground mt-4 text-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/ui/table.tsx",
        lineNumber: 99,
        columnNumber: 5
    }, this);
}
_c7 = TableCaption;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7;
__turbopack_context__.k.register(_c, "Table");
__turbopack_context__.k.register(_c1, "TableHeader");
__turbopack_context__.k.register(_c2, "TableBody");
__turbopack_context__.k.register(_c3, "TableFooter");
__turbopack_context__.k.register(_c4, "TableRow");
__turbopack_context__.k.register(_c5, "TableHead");
__turbopack_context__.k.register(_c6, "TableCell");
__turbopack_context__.k.register(_c7, "TableCaption");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/udaman/dashboard/components/series/meta-data-table.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MetaDataTable",
    ()=>MetaDataTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/shared/utils/index.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/@tanstack/react-table/build/lib/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$table$2d$core$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/@tanstack/table-core/build/lib/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$common$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/common.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/ui/table.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
function MetaDataTable(param) {
    let { metadata } = param;
    _s();
    console.log("MetaDataTable", metadata);
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "MetaDataTable.useMemo[data]": ()=>{
            var _metadata_source_link;
            return [
                {
                    name: "Universe",
                    value: metadata.s_universe
                },
                {
                    name: "Aliases",
                    value: metadata.aliases.length > 0 ? metadata.aliases.length : "-"
                },
                {
                    name: "Measurements",
                    value: metadata.measurement.map({
                        "MetaDataTable.useMemo[data]": (m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                href: "/measurements/".concat(m.id),
                                className: "block hover:underline",
                                children: m.prefix
                            }, "".concat(m.id), false, {
                                fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                                lineNumber: 42,
                                columnNumber: 11
                            }, this)
                    }["MetaDataTable.useMemo[data]"])
                },
                {
                    name: "Description",
                    value: metadata.s_description
                },
                {
                    name: "Aremos Desc.",
                    value: metadata.s_name
                },
                {
                    name: "Units",
                    value: "".concat(metadata.u_long_label, " (").concat(metadata.u_short_label, ")")
                },
                {
                    name: "Geography",
                    value: metadata.geo_display_name
                },
                {
                    name: "Decimals",
                    value: metadata.s_decimals
                },
                {
                    name: "Seasonal Adjustment",
                    value: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$common$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SAIndicator"], {
                        sa: metadata.xs_seasonal_adjustment
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                        lineNumber: 61,
                        columnNumber: 16
                    }, this)
                },
                {
                    name: "Source",
                    value: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        className: "hover:underline",
                        href: (_metadata_source_link = metadata.source_link) !== null && _metadata_source_link !== void 0 ? _metadata_source_link : "#",
                        children: metadata.source_description
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                        lineNumber: 66,
                        columnNumber: 11
                    }, this)
                },
                {
                    name: "Source Details",
                    value: metadata.source_detail_description
                },
                {
                    name: "Restricted",
                    value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["numBool"])(metadata.xs_restricted) ? "True" : "False"
                },
                {
                    name: "Quarantined",
                    value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["numBool"])(metadata.xs_quarantined) ? "True" : "False"
                },
                {
                    name: "Created at",
                    value: new Date(metadata.s_created_at).toDateString()
                },
                {
                    name: "Updated at",
                    value: new Date(metadata.s_updated_at).toDateString()
                },
                {
                    name: "XID (devs only)",
                    value: metadata.xs_id
                },
                {
                    name: "Internal ID",
                    value: metadata.s_id
                }
            ];
        }
    }["MetaDataTable.useMemo[data]"], [
        metadata
    ]);
    const columns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "MetaDataTable.useMemo[columns]": ()=>[
                {
                    accessorKey: "name",
                    header: "Property",
                    meta: {
                        className: "w-32"
                    },
                    cell: {
                        "MetaDataTable.useMemo[columns]": (param)=>{
                            let { cell } = param;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium",
                                children: cell.getValue()
                            }, void 0, false, {
                                fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                                lineNumber: 103,
                                columnNumber: 11
                            }, this);
                        }
                    }["MetaDataTable.useMemo[columns]"]
                },
                {
                    accessorKey: "value",
                    header: "Value",
                    meta: {
                        className: "max-w-64"
                    },
                    cell: {
                        "MetaDataTable.useMemo[columns]": (param)=>{
                            let { cell } = param;
                            return cell.getValue();
                        }
                    }["MetaDataTable.useMemo[columns]"]
                }
            ]
    }["MetaDataTable.useMemo[columns]"], []);
    const table = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"])({
        data,
        columns,
        getCoreRowModel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$table$2d$core$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCoreRowModel"])()
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-xl font-bold opacity-80",
                        children: metadata.s_name
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                        lineNumber: 127,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-primary/80 text-lg font-bold",
                        children: metadata.s_dataPortalName
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                        lineNumber: 128,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                lineNumber: 126,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Table"], {
                className: "cursor-default",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableBody"], {
                    children: table.getRowModel().rows.map((row, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("py-1", index % 2 === 0 ? "bg-muted" : "bg-none"),
                            children: row.getVisibleCells().map((cell)=>{
                                var _cell_column_columnDef_meta;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                                    className: (_cell_column_columnDef_meta = cell.column.columnDef.meta) === null || _cell_column_columnDef_meta === void 0 ? void 0 : _cell_column_columnDef_meta.className,
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(cell.column.columnDef.cell, cell.getContext())
                                }, cell.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                                    lineNumber: 141,
                                    columnNumber: 17
                                }, this);
                            })
                        }, row.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                            lineNumber: 136,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                    lineNumber: 134,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/udaman/dashboard/components/series/meta-data-table.tsx",
        lineNumber: 125,
        columnNumber: 5
    }, this);
}
_s(MetaDataTable, "tryZKw+14Pbz2wJLa7MuCgSat1w=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"]
    ];
});
_c = MetaDataTable;
var _c;
__turbopack_context__.k.register(_c, "MetaDataTable");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/udaman/shared/utils/time.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addMonths$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/addMonths.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addQuarters$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/addQuarters.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addYears$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/addYears.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/differenceInDays.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/format.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/isAfter.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/startOfMonth.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfQuarter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/startOfQuarter.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfYear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/startOfYear.js [app-client] (ecmascript)");
;
/* Functions for generating date lists for use in tables, charts, etc. Initially used in CPI-RPP portal */ function generateDates(startDate, endDate, frequency, formatString) {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("generateDates: invalid dates passed as arguments");
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(startDate, endDate)) {
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
function generateMonths(startDate, endDate) {
    let formatString = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "yyyy-MM";
    const months = [];
    let current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfMonth"])(startDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfMonth$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfMonth"])(endDate);
    while(!(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(current, end)){
        months.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(current, formatString));
        current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addMonths$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addMonths"])(current, 1);
    }
    return months;
}
function generateQuarters(startDate, endDate) {
    let formatString = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "yyyy-'Q'Q";
    const quarters = [];
    let current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfQuarter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfQuarter"])(startDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfQuarter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfQuarter"])(endDate);
    while(!(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(current, end)){
        quarters.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(current, formatString));
        current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addQuarters$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addQuarters"])(current, 1);
    }
    return quarters;
}
function generateYears(startDate, endDate) {
    let formatString = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "yyyy";
    const years = [];
    let current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfYear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfYear"])(startDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$startOfYear$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startOfYear"])(endDate);
    while(!(0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$isAfter$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAfter"])(current, end)){
        years.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(current, formatString));
        current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$addYears$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addYears"])(current, 1);
    }
    return years;
}
/** Try to keep display formats consistent across all systems */ const uheroDate = (date, freq)=>{
    switch(freq){
        case "M":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "MMM yyyy");
        case "Q":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy QQQ");
        case "A":
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy");
        default:
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy-MM-dd");
    }
};
/** Generates the age field in series table. Taken from JP's ruby version. Unsure why
 * they settled on the 100 day and 10 month intervals.
 */ function dpAgeCode(updatedAt, pseudoHistory) {
    const now = new Date();
    const createdAt = new Date(updatedAt);
    const days = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$differenceInDays$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["differenceInDays"])(now, createdAt);
    const months = Math.round(days / 30.0);
    const prefix = pseudoHistory ? "*" : "";
    let ageCode;
    if (days < 100) {
        ageCode = days.toString().padStart(2, "0");
    } else if (months < 10) {
        ageCode = "".concat(months, "m");
    } else {
        let years = days / 365.0;
        years = years % 1 < 0.8 ? Math.floor(years) : Math.floor(years) + 1;
        years = years === 0 ? 1 : years;
        ageCode = "".concat(years, "y");
    }
    return prefix + ageCode;
}
function formatRuntime(runtimeSeconds) {
    if (runtimeSeconds === null) return "-";
    return "".concat(runtimeSeconds.toFixed(2), "s");
}
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/udaman/dashboard/components/helpers.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* Tailwind requires colors be named somewhere in the codebase in order to use so using
this implementation to get started, may switch to using hex codes as keys to tailwind 
colors for better colors. */ __turbopack_context__.s([
    "getColor",
    ()=>getColor
]);
const getColor = (color)=>{
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/udaman/dashboard/components/series/series-table.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SeriesDataTable",
    ()=>SeriesDataTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/shared/utils/time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/@tanstack/react-table/build/lib/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$table$2d$core$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/@tanstack/table-core/build/lib/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/ui/table.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$helpers$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/helpers.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const isNumber = (val)=>{
    if (val === null || val === undefined) return false;
    if (typeof val !== "number") return false;
    if (isNaN(val)) return false;
    return true;
};
const dpColor = (n)=>{
    if (n === 0) return "text-primary/70";
    if (n > 0) return "text-green-800";
    return "text-red-800";
};
const SeriesDataTable = (param)=>{
    let { data, options } = param;
    var _table_getRowModel_rows;
    _s();
    const { decimals } = options;
    const PercCell = (param)=>{
        let { n } = param;
        if (!isNumber(n)) return "-";
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-primary/60 w-full text-end text-xs", dpColor(n)),
            children: [
                n.toFixed(decimals),
                "%"
            ]
        }, void 0, true, {
            fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
            lineNumber: 52,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    };
    const columns = [
        {
            accessorKey: "date",
            header: "Date",
            cell: (param)=>{
                let { row } = param;
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uheroDate"])(row.getValue("date"));
            }
        },
        {
            accessorKey: "value",
            header: "Value",
            cell: (param)=>{
                let { cell } = param;
                const val = cell.getValue();
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "font-bold",
                    children: isNumber(val) ? val.toFixed(decimals) : "-"
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 72,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "yoy",
            header: "YOY",
            meta: {
                className: "text-primary/60 w-full text-end text-xs"
            },
            cell: (param)=>{
                let { cell } = param;
                const val = cell.getValue();
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PercCell, {
                    n: val
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 86,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "ytd",
            header: "YTD",
            cell: (param)=>{
                let { cell } = param;
                const val = cell.getValue();
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PercCell, {
                    n: val
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 94,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "lvl_change",
            header: "LVL",
            cell: (param)=>{
                let { cell } = param;
                const val = cell.getValue();
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PercCell, {
                    n: val
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 102,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "updated_at",
            header: "Age",
            cell: (param)=>{
                let { row } = param;
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["dpAgeCode"])(row.getValue("updated_at"), row.getValue("pseudo_history"));
            }
        },
        {
            accessorKey: "loader_id",
            header: "Loader"
        },
        {
            accessorKey: "pseudo_history",
            header: "pseudo_history"
        },
        {
            accessorKey: "color",
            header: "color"
        }
    ];
    const table = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"])({
        data,
        columns,
        getCoreRowModel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$table$2d$core$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCoreRowModel"])(),
        initialState: {
            columnVisibility: {
                pseudo_history: false,
                color: false,
                loader_id: options.showLoaderCol
            }
        }
    });
    console.log("data", data[0]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Table"], {
            className: "border-separate border-spacing-1 font-mono",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableHeader"], {
                    children: table.getHeaderGroups().map((headerGroup)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            children: headerGroup.headers.map((header)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableHead"], {
                                    className: "text-end",
                                    children: header.isPlaceholder ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(header.column.columnDef.header, header.getContext())
                                }, header.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                                    lineNumber: 145,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, headerGroup.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                            lineNumber: 143,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 141,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableBody"], {
                    children: ((_table_getRowModel_rows = table.getRowModel().rows) === null || _table_getRowModel_rows === void 0 ? void 0 : _table_getRowModel_rows.length) ? table.getRowModel().rows.map((row, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            "data-state": row.getIsSelected() && "selected",
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group", i % 2 === 0 ? "bg-muted" : "bg-none"),
                            children: row.getVisibleCells().map((cell)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group-hover:bg-muted cursor-default border-b bg-white text-end", cell.column.id === "value" && (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$helpers$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getColor"])(cell.row.getValue("color"))),
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(cell.column.columnDef.cell, cell.getContext())
                                }, cell.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                                    lineNumber: 166,
                                    columnNumber: 19
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, row.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                            lineNumber: 160,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0))) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                            colSpan: columns.length,
                            className: "h-24 text-center",
                            children: "No data found."
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                            lineNumber: 182,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                        lineNumber: 181,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 157,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableHeader"], {
                    children: table.getHeaderGroups().map((headerGroup)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            children: headerGroup.headers.map((header)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableHead"], {
                                    className: "h-5 text-end",
                                    children: header.isPlaceholder ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(header.column.columnDef.header, header.getContext())
                                }, header.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                                    lineNumber: 192,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, headerGroup.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                            lineNumber: 190,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
                    lineNumber: 188,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
            lineNumber: 140,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/series/series-table.tsx",
        lineNumber: 139,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(SeriesDataTable, "+qfJc9U8evODZQ8bBg9G2KVouAc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"]
    ];
});
_c = SeriesDataTable;
var _c;
__turbopack_context__.k.register(_c, "SeriesDataTable");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=udaman_14d95b9a._.js.map