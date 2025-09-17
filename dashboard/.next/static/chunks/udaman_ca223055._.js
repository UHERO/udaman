(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
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
"[project]/udaman/dashboard/components/series/series-list-table.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SeriesDataTable",
    ()=>SeriesDataTable,
    "SeriesListTable",
    ()=>SeriesListTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$shared$2f$utils$2f$time$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/shared/utils/time.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/@tanstack/react-table/build/lib/index.mjs [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$table$2d$core$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/node_modules/@tanstack/table-core/build/lib/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/udaman/node_modules/date-fns/format.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/ui/table.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$common$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/udaman/dashboard/components/common.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
function SeriesListTable(param) {
    let { data } = param;
    var _table_getRowModel_rows;
    _s();
    const columns = [
        {
            accessorKey: "name",
            header: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "Name"
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 38,
                            columnNumber: 11
                        }, this),
                        " ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-xs no-underline opacity-70",
                            children: "name@geo.freq"
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 39,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true),
            cell: (param)=>{
                let { row } = param;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: "/series/".concat(row.original.id),
                    children: row.getValue("name")
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 44,
                    columnNumber: 11
                }, this);
            }
        },
        {
            accessorKey: "seasonalAdjustment",
            header: "SA",
            cell: (param)=>{
                let { row } = param;
                const sa = row.getValue("seasonalAdjustment");
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$common$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SAIndicator"], {
                    sa: sa
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 55,
                    columnNumber: 16
                }, this);
            }
        },
        {
            accessorKey: "portalName",
            header: "Portal Name"
        },
        {
            accessorKey: "unitShortLabel",
            header: "Units"
        },
        {
            accessorKey: "minDate",
            header: "First",
            cell: (param)=>{
                let { row } = param;
                const date = row.getValue("minDate");
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy-MM-dd");
            }
        },
        {
            accessorKey: "maxDate",
            header: "Last",
            cell: (param)=>{
                let { row } = param;
                const date = row.getValue("maxDate");
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$date$2d$fns$2f$format$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, "yyyy-MM-dd");
            }
        },
        {
            accessorKey: "sourceDescription",
            header: "Source",
            cell: (param)=>{
                let { row } = param;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-48 truncate",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "#",
                        className: "hover:font-medium hover:underline",
                        children: row.getValue("sourceDescription")
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                        lineNumber: 87,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 86,
                    columnNumber: 9
                }, this);
            }
        }
    ];
    const table = (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"])({
        data,
        columns,
        getCoreRowModel: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$table$2d$core$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCoreRowModel"])()
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "overflow-hidden rounded-md bg-white",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Table"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableHeader"], {
                    children: table.getHeaderGroups().map((headerGroup)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            children: headerGroup.headers.map((header)=>{
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableHead"], {
                                    children: header.isPlaceholder ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(header.column.columnDef.header, header.getContext())
                                }, header.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                                    lineNumber: 109,
                                    columnNumber: 19
                                }, this);
                            })
                        }, headerGroup.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 106,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 104,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableBody"], {
                    children: ((_table_getRowModel_rows = table.getRowModel().rows) === null || _table_getRowModel_rows === void 0 ? void 0 : _table_getRowModel_rows.length) ? table.getRowModel().rows.map((row, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            "data-state": row.getIsSelected() && "selected",
                            className: i % 2 === 0 ? "bg-muted" : "bg-none",
                            children: row.getVisibleCells().map((cell)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(cell.column.columnDef.cell, cell.getContext())
                                }, cell.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                                    lineNumber: 131,
                                    columnNumber: 19
                                }, this))
                        }, row.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 125,
                            columnNumber: 15
                        }, this)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                            colSpan: columns.length,
                            className: "h-24 text-center",
                            children: "No results."
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 139,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                        lineNumber: 138,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 122,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
            lineNumber: 103,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
        lineNumber: 102,
        columnNumber: 5
    }, this);
}
_s(SeriesListTable, "+qfJc9U8evODZQ8bBg9G2KVouAc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"]
    ];
});
_c = SeriesListTable;
const SeriesDataTable = (param)=>{
    let { data, options } = param;
    var _table_getRowModel_rows;
    _s1();
    const { decimals } = options;
    /* 
  Table needs to know about
    - series id for link to dp vintages view: /data-points/[id]
    - loaders (source?)
      - to highlight dp w/ loader-color
      - show loader # column if more than 1 loader
  */ const columns = [
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
                const val = cell.getValue().toFixed(decimals);
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "size-full font-bold",
                    children: val
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 176,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "yoy",
            header: "YOY",
            cell: (param)=>{
                let { cell } = param;
                const val = cell.getValue();
                const displayVal = val === null ? "-" : val.toFixed(1) + "%";
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-primary/60 w-full text-end text-xs", parseInt(val) >= 0 ? "text-green-800" : "text-red-800"),
                    children: displayVal
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 187,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "ytd",
            header: "YTD",
            cell: (param)=>{
                let { row } = param;
                const val = row.getValue("ytd");
                const displayVal = val === null ? "-" : val.toFixed(1) + "%";
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-primary/60 w-full text-end text-xs", parseInt(val) >= 0 ? "text-green-800" : "text-red-800"),
                    children: displayVal
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 205,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0));
            }
        },
        {
            accessorKey: "lvl_change",
            header: "LVL",
            cell: (param)=>{
                let { row } = param;
                const val = row.getValue("lvl_change");
                const displayVal = val === null ? "-" : val.toFixed(1) + "%";
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-primary/60 w-full text-end text-xs", parseInt(val) >= 0 ? "text-green-800" : "text-red-800"),
                    children: displayVal
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 223,
                    columnNumber: 11
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
                color: false
            }
        }
    });
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
                                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                                    lineNumber: 269,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, headerGroup.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 267,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 265,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableBody"], {
                    children: ((_table_getRowModel_rows = table.getRowModel().rows) === null || _table_getRowModel_rows === void 0 ? void 0 : _table_getRowModel_rows.length) ? table.getRowModel().rows.map((row, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                            "data-state": row.getIsSelected() && "selected",
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group", i % 2 === 0 ? "bg-muted" : "bg-none"),
                            children: row.getVisibleCells().map((cell)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("group-hover:bg-muted cursor-default border-b bg-white text-end", cell.column.id === "value" && (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getColor"])(cell.row.getValue("color"))),
                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["flexRender"])(cell.column.columnDef.cell, cell.getContext())
                                }, cell.id, false, {
                                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                                    lineNumber: 290,
                                    columnNumber: 19
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, row.id, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 284,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0))) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableRow"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$dashboard$2f$components$2f$ui$2f$table$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TableCell"], {
                            colSpan: columns.length,
                            className: "h-24 text-center",
                            children: "No data found."
                        }, void 0, false, {
                            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                            lineNumber: 306,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                        lineNumber: 305,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
                    lineNumber: 281,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
            lineNumber: 264,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/udaman/dashboard/components/series/series-list-table.tsx",
        lineNumber: 263,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s1(SeriesDataTable, "+qfJc9U8evODZQ8bBg9G2KVouAc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$udaman$2f$node_modules$2f40$tanstack$2f$react$2d$table$2f$build$2f$lib$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useReactTable"]
    ];
});
_c1 = SeriesDataTable;
var _c, _c1;
__turbopack_context__.k.register(_c, "SeriesListTable");
__turbopack_context__.k.register(_c1, "SeriesDataTable");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=udaman_ca223055._.js.map