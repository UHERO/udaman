"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import {
  getAppLogs,
  getLogFileEntries,
  type SerializedAppLogRow,
} from "@/actions/app-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AppLogCounts {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800",
  warn: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
};

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[level] ?? "bg-gray-100 text-gray-800"}`}
    >
      {level}
    </span>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mon} ${day}, ${hh}:${mm}:${ss}`;
}

const PAGE_SIZE = 50;

// ─── Stats Bar ──────────────────────────────────────────────────────

function StatsBar({ counts }: { counts: AppLogCounts }) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="rounded-md border px-3 py-1.5">
        <span className="text-muted-foreground text-xs">Total</span>
        <p className="text-sm font-semibold">{counts.total.toLocaleString()}</p>
      </div>
      {(["info", "warn", "error"] as const).map((level) => (
        <div key={level} className="rounded-md border px-3 py-1.5">
          <LevelBadge level={level} />
          <p className="mt-0.5 text-sm font-semibold">
            {(counts.byLevel[level] ?? 0).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Database Logs Tab ──────────────────────────────────────────────

function DatabaseLogsTab({
  initialData,
  categories,
  counts,
  users,
}: {
  initialData: { logs: SerializedAppLogRow[]; total: number };
  categories: string[];
  counts: AppLogCounts;
  users: Array<{ id: number; email: string }>;
}) {
  const [data, setData] = useState(initialData);
  const [level, setLevel] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    (overrides?: {
      offset?: number;
      level?: string;
      category?: string;
      userId?: string;
      name?: string;
    }) => {
      const effectiveOffset = overrides?.offset ?? offset;
      const effectiveLevel = overrides?.level ?? level;
      const effectiveCategory = overrides?.category ?? category;
      const effectiveUserId = overrides?.userId ?? userId;
      const effectiveName = overrides?.name ?? nameFilter;

      startTransition(async () => {
        const result = await getAppLogs({
          level:
            effectiveLevel === "all"
              ? undefined
              : (effectiveLevel as "info" | "warn" | "error"),
          category: effectiveCategory === "all" ? undefined : effectiveCategory,
          userId:
            effectiveUserId === "all" ? undefined : Number(effectiveUserId),
          name: effectiveName || undefined,
          limit: PAGE_SIZE,
          offset: effectiveOffset,
        });
        setData(result);
      });
    },
    [offset, level, category, userId, nameFilter],
  );

  function handleLevelChange(val: string) {
    setLevel(val);
    setOffset(0);
    refresh({ offset: 0, level: val });
  }

  function handleCategoryChange(val: string) {
    setCategory(val);
    setOffset(0);
    refresh({ offset: 0, category: val });
  }

  function handleUserChange(val: string) {
    setUserId(val);
    setOffset(0);
    refresh({ offset: 0, userId: val });
  }

  function handleNameInput(val: string) {
    setNameFilter(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      refresh({ offset: 0, name: val });
    }, 400);
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handlePrev() {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    refresh({ offset: newOffset });
  }

  function handleNext() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    refresh({ offset: newOffset });
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <StatsBar counts={counts} />

      {/* Filters + refresh */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={level} onValueChange={handleLevelChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={userId} onValueChange={handleUserChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search name..."
          value={nameFilter}
          onChange={(e) => handleNameInput(e.target.value)}
          className="w-40"
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {data.total} total
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={isPending}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      {data.logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No log entries found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Time</TableHead>
                <TableHead className="w-20">Level</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-36">User</TableHead>
                <TableHead className="w-8 px-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((row) => (
                <DatabaseLogRow
                  key={row.id}
                  row={row}
                  expanded={expandedId === row.id}
                  onToggle={() =>
                    setExpandedId(expandedId === row.id ? null : row.id)
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrev}
            disabled={offset === 0 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handleNext}
            disabled={offset + PAGE_SIZE >= data.total || isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function DatabaseLogRow({
  row,
  expanded,
  onToggle,
}: {
  row: SerializedAppLogRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={onToggle}>
        <TableCell className="text-xs">
          {formatTimestamp(row.createdAt)}
        </TableCell>
        <TableCell>
          <LevelBadge level={row.level} />
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {row.category}
        </TableCell>
        <TableCell className="max-w-xs truncate text-sm">{row.name}</TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {row.username ?? (row.userId ? `#${row.userId}` : "")}
        </TableCell>
        <TableCell className="px-2">
          {row.metadata && (
            <ChevronDown
              className={`text-muted-foreground h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </TableCell>
      </TableRow>
      {expanded && row.metadata && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Server Logs Tab ────────────────────────────────────────────────

function ServerLogsTab({ initialLines }: { initialLines: string[] }) {
  const [lines, setLines] = useState(initialLines);
  const [lineCount, setLineCount] = useState("200");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh(count?: string) {
    const effectiveCount = count ?? lineCount;
    startTransition(async () => {
      const result = await getLogFileEntries({
        lines: Number(effectiveCount),
      });
      setLines(result);
      setExpandedIdx(null);
    });
  }

  function handleLineCountChange(val: string) {
    setLineCount(val);
    refresh(val);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={lineCount} onValueChange={handleLineCountChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Lines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 lines</SelectItem>
            <SelectItem value="100">100 lines</SelectItem>
            <SelectItem value="200">200 lines</SelectItem>
            <SelectItem value="500">500 lines</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {lines.length} entries
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={isPending}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No log file entries found.
        </p>
      ) : (
        <div className="rounded-md border">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Time</TableHead>
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-64">Context</TableHead>
                  <TableHead className="w-8 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono text-xs">
                {lines.map((line, i) => (
                  <ServerLogLine
                    key={`logs-${i}`}
                    line={line}
                    expanded={expandedIdx === i}
                    onToggle={() =>
                      setExpandedIdx(expandedIdx === i ? null : i)
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fields to strip from the inline context display (noisy / already shown). */
const HIDDEN_FIELDS = new Set([
  "time",
  "level",
  "msg",
  "name",
  "pid",
  "hostname",
  "v",
]);

function parseServerLog(line: string) {
  const parsed = JSON.parse(line);
  const time = parsed.time
    ? formatTimestamp(new Date(parsed.time).toISOString())
    : "";
  const level =
    parsed.level === 30
      ? "info"
      : parsed.level === 40
        ? "warn"
        : parsed.level === 50
          ? "error"
          : parsed.level === 20
            ? "debug"
            : String(parsed.level);

  // Separate context fields (shown inline) from the full object (shown expanded)
  const context: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!HIDDEN_FIELDS.has(k)) context[k] = v;
  }

  return { parsed, time, level, msg: parsed.msg, name: parsed.name, context };
}

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

function ServerLogLine({
  line,
  expanded,
  onToggle,
}: {
  line: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  try {
    const { parsed, time, level, msg, name, context } = parseServerLog(line);
    const contextKeys = Object.keys(context);
    const hasDetails = contextKeys.length > 0;

    return (
      <>
        <TableRow
          className="hover:bg-muted/50 cursor-pointer"
          onClick={onToggle}
        >
          <TableCell className="whitespace-nowrap">{time}</TableCell>
          <TableCell>
            <LevelBadge level={level} />
          </TableCell>
          <TableCell>
            {name && <span className="text-muted-foreground">[{name}] </span>}
            {msg}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {contextKeys.length <= 3 ? (
              <span className="flex flex-wrap gap-x-2">
                {contextKeys.map((k) => (
                  <span key={k}>
                    <span className="text-muted-foreground/60">{k}=</span>
                    {formatContextValue(context[k])}
                  </span>
                ))}
              </span>
            ) : (
              <span>{contextKeys.length} fields</span>
            )}
          </TableCell>
          <TableCell className="px-2">
            {hasDetails && (
              <ChevronDown
                className={`text-muted-foreground h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            )}
          </TableCell>
        </TableRow>
        {expanded && (
          <TableRow>
            <TableCell colSpan={5} className="bg-muted/30 p-4">
              <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </TableCell>
          </TableRow>
        )}
      </>
    );
  } catch {
    return (
      <TableRow>
        <TableCell colSpan={5} className="text-muted-foreground">
          {line}
        </TableCell>
      </TableRow>
    );
  }
}

// ─── Main Panel ─────────────────────────────────────────────────────

export function LogsPanel({
  initialDbLogs,
  initialFileLogs,
  categories,
  counts,
  users,
}: {
  initialDbLogs: { logs: SerializedAppLogRow[]; total: number };
  initialFileLogs: string[];
  categories: string[];
  counts: AppLogCounts;
  users: Array<{ id: number; email: string }>;
}) {
  return (
    <Tabs defaultValue="database">
      <TabsList variant="line">
        <TabsTrigger value="database">Database Logs</TabsTrigger>
        <TabsTrigger value="server">Server Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="database">
        <DatabaseLogsTab
          initialData={initialDbLogs}
          categories={categories}
          counts={counts}
          users={users}
        />
      </TabsContent>

      <TabsContent value="server">
        <ServerLogsTab initialLines={initialFileLogs} />
      </TabsContent>
    </Tabs>
  );
}
