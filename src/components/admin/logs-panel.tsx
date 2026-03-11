"use client";

import { useState, useTransition } from "react";
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

// ─── Database Logs Tab ──────────────────────────────────────────────

function DatabaseLogsTab({
  initialData,
}: {
  initialData: { logs: SerializedAppLogRow[]; total: number };
}) {
  const [data, setData] = useState(initialData);
  const [level, setLevel] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh(
    newOffset?: number,
    newLevel?: string,
    newCategory?: string,
  ) {
    const effectiveOffset = newOffset ?? offset;
    const effectiveLevel = newLevel ?? level;
    const effectiveCategory = newCategory ?? category;

    startTransition(async () => {
      const result = await getAppLogs({
        level:
          effectiveLevel === "all"
            ? undefined
            : (effectiveLevel as "info" | "warn" | "error"),
        category: effectiveCategory === "all" ? undefined : effectiveCategory,
        limit: PAGE_SIZE,
        offset: effectiveOffset,
      });
      setData(result);
    });
  }

  function handleLevelChange(val: string) {
    setLevel(val);
    setOffset(0);
    refresh(0, val, undefined);
  }

  function handleCategoryChange(val: string) {
    setCategory(val);
    setOffset(0);
    refresh(0, undefined, val);
  }

  function handlePrev() {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    refresh(newOffset);
  }

  function handleNext() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    refresh(newOffset);
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-3">
      {/* Filters + refresh */}
      <div className="flex items-center gap-3">
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
            <SelectItem value="page_view">Page View</SelectItem>
            <SelectItem value="action">Action</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

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
  const [isPending, startTransition] = useTransition();

  function refresh(count?: string) {
    const effectiveCount = count ?? lineCount;
    startTransition(async () => {
      const result = await getLogFileEntries({
        lines: Number(effectiveCount),
      });
      setLines(result);
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
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Time</th>
                  <th className="px-3 py-1.5 text-left font-medium">Level</th>
                  <th className="px-3 py-1.5 text-left font-medium">Event</th>
                  <th className="px-3 py-1.5 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {lines.map((line, i) => (
                  <ServerLogLine key={i} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerLogLine({ line }: { line: string }) {
  try {
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
            : String(parsed.level);
    const { time: _t, level: _l, msg, name, ...rest } = parsed;
    const details = Object.keys(rest).length > 0 ? JSON.stringify(rest) : "";

    return (
      <tr className="hover:bg-muted/30 border-t">
        <td className="px-3 py-1 whitespace-nowrap">{time}</td>
        <td className="px-3 py-1">
          <LevelBadge level={level} />
        </td>
        <td className="px-3 py-1">
          {name && <span className="text-muted-foreground">[{name}] </span>}
          {msg}
        </td>
        <td className="text-muted-foreground max-w-md truncate px-3 py-1">
          {details}
        </td>
      </tr>
    );
  } catch {
    return (
      <tr className="hover:bg-muted/30 border-t">
        <td colSpan={4} className="text-muted-foreground px-3 py-1">
          {line}
        </td>
      </tr>
    );
  }
}

// ─── Main Panel ─────────────────────────────────────────────────────

export function LogsPanel({
  initialDbLogs,
  initialFileLogs,
}: {
  initialDbLogs: { logs: SerializedAppLogRow[]; total: number };
  initialFileLogs: string[];
}) {
  return (
    <Tabs defaultValue="database">
      <TabsList variant="line">
        <TabsTrigger value="database">Database Logs</TabsTrigger>
        <TabsTrigger value="server">Server Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="database">
        <DatabaseLogsTab initialData={initialDbLogs} />
      </TabsContent>

      <TabsContent value="server">
        <ServerLogsTab initialLines={initialFileLogs} />
      </TabsContent>
    </Tabs>
  );
}
