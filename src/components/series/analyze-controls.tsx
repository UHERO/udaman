"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatEventType } from "@catalog/models/timeline-event";
import { formatLevel } from "@catalog/utils/format";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  LineChart,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  createTimelineEventAction,
  deleteTimelineEventAction,
  updateTimelineEventAction,
} from "@/actions/timeline-events";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  applyTransformationMulti,
  computeOverlaysMulti,
  LevelChart,
  SERIES_COLORS,
  TRANSFORMATION_LABELS,
  type BarMode,
  type ChartRow,
  type Overlay,
  type TimelineEventForChart,
  type Transformation,
} from "./analyze-chart";
import { AnalyzeDataTable } from "./analyze-data-table";
import { AnalyzerSeriesRow } from "./analyzer/analyzer-series-row";
import type { AnalyzerEntry } from "./analyzer/types";

/* ------------------------------------------------------------------ */
/*  Toggle item with built-in tooltip                                  */
/*  Tooltip trigger is INSIDE the ToggleGroupItem so the item remains  */
/*  a direct child of the group — preserving first/last CSS rounding.  */
/* ------------------------------------------------------------------ */

function TooltipToggleItem({
  value,
  formula,
  description,
  className,
  children,
}: {
  value: string;
  formula: React.ReactNode;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroupItem value={value} className={className}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5">{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-64 space-y-1 px-3 py-2"
        >
          <div className="font-mono text-[11px] leading-relaxed">{formula}</div>
          {description && (
            <div className="text-[10px] opacity-70">{description}</div>
          )}
        </TooltipContent>
      </TooltipRoot>
    </ToggleGroupItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle panel sub-components                                        */
/* ------------------------------------------------------------------ */

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0">
      <span className="text-muted-foreground text-[10px] leading-tight">
        {label}
      </span>
      <span className="font-mono text-xs leading-tight font-medium">
        {value}
      </span>
    </div>
  );
}

function FreqDateInput({
  dateStr,
  freqCode,
  onCommit,
}: {
  dateStr: string;
  freqCode: string | null | undefined;
  onCommit: (isoDate: string) => void;
}) {
  const formatted = formatDateForInput(dateStr, freqCode);
  const [value, setValue] = useState(formatted);
  const [invalid, setInvalid] = useState(false);

  // Sync when the external date changes (e.g. brush drag or preset click)
  useEffect(() => {
    setValue(formatDateForInput(dateStr, freqCode));
    setInvalid(false);
  }, [dateStr, freqCode]);

  const commit = () => {
    if (value === formatted) return;
    const parsed = parseDateFromInput(value, freqCode);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(parsed);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "text-muted-foreground w-24 border-b bg-transparent px-0.5 py-0.5 font-mono text-sm outline-none transition-colors",
        "focus:border-blue-500 focus:text-foreground",
        invalid ? "border-red-400" : "border-stone-300 dark:border-stone-600",
      )}
    />
  );
}

function ControlPanel({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2 py-1">{children}</div>
    </TooltipProvider>
  );
}

/** Overlays that use the rolling window parameter */
const ROLLING_OVERLAYS: Overlay[] = ["rollingMean", "rollingStdDev"];

/** Periods per year by frequency code */
const PERIODS_PER_YEAR: Record<string, number> = {
  D: 365,
  W: 52,
  M: 12,
  Q: 4,
  S: 2,
  A: 1,
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format a YYYY-MM-DD date string at the series' native frequency resolution */
function formatFreqDate(
  dateStr: string,
  freqCode: string | null | undefined,
): string {
  if (!dateStr || dateStr.length < 4) return dateStr;
  const year = dateStr.slice(0, 4);
  const month = dateStr.length >= 7 ? parseInt(dateStr.slice(5, 7), 10) : 1;
  const day = dateStr.length >= 10 ? dateStr.slice(8, 10) : "01";

  switch (freqCode) {
    case "A":
      return year;
    case "S":
      return `${year} ${month <= 6 ? "H1" : "H2"}`;
    case "Q":
      return `${year} Q${Math.ceil(month / 3)}`;
    case "M":
      return `${SHORT_MONTHS[month - 1]} ${year}`;
    case "W":
    case "D":
      return `${SHORT_MONTHS[month - 1]} ${parseInt(day, 10)}, ${year}`;
    default:
      return `${SHORT_MONTHS[month - 1]} ${year}`;
  }
}

/** Format a YYYY-MM-DD date for inline editing based on frequency */
function formatDateForInput(
  dateStr: string,
  freqCode: string | null | undefined,
): string {
  if (!dateStr || dateStr.length < 4) return dateStr;
  const year = dateStr.slice(0, 4);
  const month = dateStr.length >= 7 ? parseInt(dateStr.slice(5, 7), 10) : 1;
  const day = dateStr.length >= 10 ? parseInt(dateStr.slice(8, 10), 10) : 1;

  if (freqCode === "A") return year;
  if (freqCode === "Q") return `${year}Q${Math.ceil(month / 3)}`;
  return `${year}-${month}-${day}`;
}

const QUARTER_START_MONTH: Record<number, string> = {
  1: "01",
  2: "04",
  3: "07",
  4: "10",
};

/** Parse a user-typed date string back to YYYY-MM-DD */
function parseDateFromInput(
  input: string,
  freqCode: string | null | undefined,
): string | null {
  const s = input.trim();
  if (!s) return null;

  if (freqCode === "A") {
    const y = parseInt(s, 10);
    if (isNaN(y) || y < 1900 || y > 2200) return null;
    return `${y}-01-01`;
  }

  if (freqCode === "Q") {
    const m = s.match(/^(\d{4})[Qq]([1-4])$/);
    if (!m) return null;
    return `${m[1]}-${QUARTER_START_MONTH[parseInt(m[2], 10)]}-01`;
  }

  // Monthly and higher: YYYY-M-D
  const parts = s.split("-");
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  const d = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
  if (isNaN(y) || isNaN(mo) || isNaN(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Find the chart data index whose date is closest to `target` (YYYY-MM-DD) */
function findClosestDateIndex(
  data: ChartRow[],
  target: string,
  direction: "start" | "end" = "start",
): number {
  // For start dates, find the first index >= target
  // For end dates, find the last index <= target
  if (direction === "start") {
    for (let i = 0; i < data.length; i++) {
      if (data[i].date >= target) return i;
    }
    return data.length - 1;
  }
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].date <= target) return i;
  }
  return 0;
}

/** Date range presets — 1Y only shown for monthly+ series */
const RANGE_PRESETS = [
  { label: "1Y", years: 1, minPPY: 12 },
  { label: "5Y", years: 5, minPPY: 0 },
  { label: "10Y", years: 10, minPPY: 0 },
  { label: "20Y", years: 20, minPPY: 0 },
  { label: "MAX", years: Infinity, minPPY: 0 },
];
const DEFAULT_RANGE_PRESET = "5Y";
const DEFAULT_RANGE_YEARS = 5;

/* ------------------------------------------------------------------ */
/*  URL sync helpers                                                    */
/* ------------------------------------------------------------------ */

const MANAGED_PARAMS = [
  "overlays",
  "events",
  "transform",
  "secondAxisTransform",
  "rightOverlays",
  "barMode",
  "rollingWindow",
  "indexDate",
  "range",
  "rangeStart",
  "rangeEnd",
  "stdDevMultiplier",
  "leftChartType",
  "rightChartType",
] as const;

const VALID_OVERLAYS = new Set<Overlay>([
  "rollingMean",
  "linearTrend",
  "logLinearTrend",
  "hpTrend",
  "mean",
  "stdDev",
  "rollingStdDev",
]);

const VALID_TRANSFORMATIONS = new Set<Transformation>([
  "zScore",
  "deviationFromTrend",
  "logLevel",
  "indexToYear",
  "rollingMean",
  "linearTrend",
  "logLinearTrend",
  "hpTrend",
  "yoy",
  "ytd",
  "pop",
  "levelChange",
  "cagr",
]);

const VALID_BAR_MODES = new Set<BarMode>(["yoy", "ytd", "levelChange", "pop"]);

function parseOverlays(v: string | null): Overlay[] {
  if (!v) return [];
  return v
    .split(",")
    .filter((s): s is Overlay => VALID_OVERLAYS.has(s as Overlay));
}

/** Parse selected event types from URL */
function parseEventTypes(v: string | null): Set<string> {
  if (!v) return new Set();
  return new Set(v.split(",").filter(Boolean));
}

function parseTransformation(v: string | null): Transformation | null {
  if (!v) return null;
  return VALID_TRANSFORMATIONS.has(v as Transformation)
    ? (v as Transformation)
    : null;
}

function parseBarMode(v: string | null): BarMode {
  if (!v) return "yoy";
  return VALID_BAR_MODES.has(v as BarMode) ? (v as BarMode) : "yoy";
}

function syncParamsToUrl(params: Record<string, string | undefined>) {
  const url = new URL(window.location.href);
  for (const key of MANAGED_PARAMS) url.searchParams.delete(key);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  window.history.replaceState(null, "", url.toString());
}

/** Find the start index for showing the last N years of data */
function getRangeStartIndex(chartData: ChartRow[], years: number): number {
  if (!isFinite(years) || chartData.length === 0) return 0;
  const lastDate = chartData[chartData.length - 1].date;
  const cutoff = new Date(lastDate);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (let i = 0; i < chartData.length; i++) {
    if (chartData[i].date >= cutoffStr) return i;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Timeline event form (shared by create + edit in the Sheet)         */
/* ------------------------------------------------------------------ */

type EventFormData = {
  name: string;
  eventType: string;
  description: string;
  startDate: string;
  endDate: string;
};

const emptyEventForm: EventFormData = {
  name: "",
  eventType: "recession",
  description: "",
  startDate: "",
  endDate: "",
};

/** Combobox that shows existing event types but allows typing a new one */
function EventTypeCombobox({
  value,
  onChange,
  existingTypes,
}: {
  value: string;
  onChange: (v: string) => void;
  existingTypes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return existingTypes;
    const lower = search.toLowerCase();
    return existingTypes.filter(
      (t) =>
        t.toLowerCase().includes(lower) ||
        formatEventType(t).toLowerCase().includes(lower),
    );
  }, [existingTypes, search]);

  const normalizedSearch = search.trim().toLowerCase().replace(/\s+/g, "_");
  const showCreateOption =
    search.trim() && !existingTypes.some((t) => t === normalizedSearch);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-sm font-normal"
        >
          {value ? formatEventType(value) : "Select type..."}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        style={{ zIndex: 60 }}
      >
        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder="Search or type new..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-48 overflow-y-auto px-1 pb-1">
          {filtered.map((type) => (
            <button
              key={type}
              type="button"
              className={cn(
                "hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                value === type && "bg-accent",
              )}
              onClick={() => {
                onChange(type);
                setSearch("");
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  value === type ? "opacity-100" : "opacity-0",
                )}
              />
              {formatEventType(type)}
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {type}
              </span>
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
              onClick={() => {
                onChange(normalizedSearch);
                setSearch("");
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Create &quot;{formatEventType(normalizedSearch)}&quot;
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {normalizedSearch}
              </span>
            </button>
          )}
          {filtered.length === 0 && !showCreateOption && (
            <p className="text-muted-foreground px-2 py-3 text-center text-sm">
              No types found.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimelineEventForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  onDelete,
  isPending,
  isEdit,
  existingTypes,
}: {
  form: EventFormData;
  onChange: (f: EventFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  isPending: boolean;
  isEdit: boolean;
  existingTypes: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="te-name" className="text-xs">
          Name *
        </Label>
        <Input
          id="te-name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Great Recession (2007-09)"
          className="h-8 text-sm"
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Event Type *</Label>
        <EventTypeCombobox
          value={form.eventType}
          onChange={(v) => onChange({ ...form, eventType: v })}
          existingTypes={existingTypes}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="te-start" className="text-xs">
            Start Date *
          </Label>
          <Input
            id="te-start"
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ ...form, startDate: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="te-end" className="text-xs">
            End Date
          </Label>
          <Input
            id="te-end"
            type="date"
            value={form.endDate}
            onChange={(e) => onChange({ ...form, endDate: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-[10px]">
        Omit End Date to mark the start of a long running event
      </p>
      <div className="grid gap-2">
        <Label htmlFor="te-desc" className="text-xs">
          Description
        </Label>
        <Textarea
          id="te-desc"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSubmit} disabled={isPending}>
          {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        {isEdit && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isPending}
            className="ml-auto text-red-600 hover:text-red-700"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline control: popover toggle + management Sheet                */
/* ------------------------------------------------------------------ */

function TimelineControl({
  timelineEvents,
  selectedEventTypes,
  onSelectedEventTypesChange,
}: {
  timelineEvents: TimelineEventForChart[];
  selectedEventTypes: Set<string>;
  onSelectedEventTypesChange: (types: Set<string>) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<TimelineEventForChart | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<EventFormData>(emptyEventForm);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of timelineEvents) {
      map.set(e.eventType, (map.get(e.eventType) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [timelineEvents]);

  /** Events grouped by type for the sheet */
  const eventsByType = useMemo(() => {
    const map = new Map<string, TimelineEventForChart[]>();
    for (const e of timelineEvents) {
      const list = map.get(e.eventType);
      if (list) list.push(e);
      else map.set(e.eventType, [e]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [timelineEvents]);

  const existingTypes = useMemo(
    () => [...new Set(timelineEvents.map((e) => e.eventType))].sort(),
    [timelineEvents],
  );

  const toggleType = useCallback(
    (type: string) => {
      const next = new Set(selectedEventTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      onSelectedEventTypesChange(next);
    },
    [selectedEventTypes, onSelectedEventTypesChange],
  );

  function openCreate() {
    setEditingEvent(null);
    setIsCreating(true);
    setForm(emptyEventForm);
  }

  function openEdit(event: TimelineEventForChart) {
    setEditingEvent(event);
    setIsCreating(true);
    setForm({
      name: event.name,
      eventType: event.eventType,
      description: event.description ?? "",
      startDate: event.startDate ?? event.start,
      endDate: event.endDate ?? "",
    });
  }

  function cancelForm() {
    setIsCreating(false);
    setEditingEvent(null);
    setForm(emptyEventForm);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.startDate) {
      toast.error("Name and start date are required");
      return;
    }
    if (!form.eventType.trim()) {
      toast.error("Event type is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        name: form.name.trim(),
        eventType: form.eventType.trim(),
        description: form.description.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate || null,
      };
      if (editingEvent) {
        const result = await updateTimelineEventAction(
          editingEvent.id,
          payload,
        );
        toast.success(result.message);
      } else {
        const result = await createTimelineEventAction(payload);
        toast.success(result.message);
      }
      cancelForm();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!editingEvent) return;
    startTransition(async () => {
      const result = await deleteTimelineEventAction(editingEvent.id);
      toast.success(result.message);
      cancelForm();
      router.refresh();
    });
  }

  const showForm = isCreating;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
              selectedEventTypes.size > 0
                ? "border-slate-400 bg-slate-100 text-slate-700"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Timeline
            {selectedEventTypes.size > 0 && (
              <span className="rounded-full bg-slate-500 px-1.5 text-[10px] leading-4 text-white">
                {selectedEventTypes.size}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <div className="max-h-64 space-y-0.5 overflow-y-auto p-2">
            {typeCounts.map(([type, count]) => (
              <button
                key={type}
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 rounded px-1 py-1.5 text-xs"
                onClick={() => toggleType(type)}
              >
                <Checkbox
                  checked={selectedEventTypes.has(type)}
                  className="h-3.5 w-3.5"
                  tabIndex={-1}
                />
                <span>{formatEventType(type)}</span>
                <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                  {count}
                </span>
              </button>
            ))}
          </div>
          <Separator />
          <div className="p-1">
            <button
              type="button"
              className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-medium"
              onClick={() => {
                setSheetOpen(true);
              }}
            >
              <Pencil className="h-3 w-3" />
              Add or Edit Events
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Management Sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) cancelForm();
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>
              {showForm
                ? editingEvent
                  ? "Edit Event"
                  : "New Event"
                : "Timeline Events"}
            </SheetTitle>
          </SheetHeader>

          {showForm ? (
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={cancelForm}
                className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to list
              </button>
              <TimelineEventForm
                form={form}
                onChange={setForm}
                onSubmit={handleSubmit}
                onCancel={cancelForm}
                onDelete={editingEvent ? handleDelete : undefined}
                isPending={isPending}
                isEdit={!!editingEvent}
                existingTypes={existingTypes}
              />
            </div>
          ) : (
            <div className="px-4 pb-4">
              <Button size="sm" onClick={openCreate} className="mb-3 w-full">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add New Event
              </Button>

              {eventsByType.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No timeline events yet.
                </p>
              )}

              <div className="space-y-1">
                {eventsByType.map(([type, events]) => (
                  <Collapsible key={type} defaultOpen={events.length <= 8}>
                    <CollapsibleTrigger className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm font-medium">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-90" />
                      {formatEventType(type)}
                      <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                        {events.length}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 border-l pl-3">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className="hover:bg-accent group flex items-center gap-2 rounded px-2 py-1.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium">
                                {event.name}
                              </div>
                              <div className="text-muted-foreground font-mono text-[10px]">
                                {event.startDate ?? event.start}
                                {event.endDate ? ` — ${event.endDate}` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEdit(event)}
                              className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** "More" dropdown for overflow items in overlay/transform rows */
function MoreDropdown({
  items,
  activeValues,
  onToggle,
  renderItemExtra,
}: {
  items: Array<{
    value: string;
    label: string;
    formula: React.ReactNode;
    description?: string;
  }>;
  activeValues: Set<string>;
  onToggle: (value: string) => void;
  /** Render extra inline content (e.g. InlineSelect) after the label when an item is active */
  renderItemExtra?: (value: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = items.filter((i) => activeValues.has(i.value)).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
            activeCount > 0
              ? "text-blue-700"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          More
          <ChevronDown className="h-3 w-3" />
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-600 px-1 text-[9px] leading-3 text-white">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {items.map((item) => (
          <div key={item.value}>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "hover:bg-accent flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs",
                activeValues.has(item.value) && "bg-accent font-medium",
              )}
              onClick={() => onToggle(item.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(item.value);
                }
              }}
            >
              <Checkbox
                checked={activeValues.has(item.value)}
                className="h-3.5 w-3.5"
                tabIndex={-1}
              />
              {item.label}
            </div>
            {activeValues.has(item.value) && renderItemExtra?.(item.value)}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Chart type toggle: Line or Column */
function ChartTypeToggle({
  value,
  onChange,
}: {
  value: "line" | "column";
  onChange: (v: "line" | "column") => void;
}) {
  return (
    <div className="inline-flex rounded-md border">
      <button
        type="button"
        onClick={() => onChange("line")}
        className={cn(
          "inline-flex h-6 w-7 items-center justify-center rounded-l-md text-xs transition-colors",
          value === "line"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50",
        )}
        title="Line chart"
      >
        <LineChart className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange("column")}
        className={cn(
          "inline-flex h-6 w-7 items-center justify-center rounded-r-md border-l text-xs transition-colors",
          value === "column"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50",
        )}
        title="Column chart"
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Primary overlay items (shown inline) */
const PRIMARY_OVERLAYS: Array<{
  value: Overlay;
  label: string;
  formula: React.ReactNode;
  description: string;
}> = [
  {
    value: "mean",
    label: "Mean",
    formula: (
      <span>
        x̄ = <sup>1</sup>&frasl;<sub>n</sub> &Sigma; x<sub>i</sub>
      </span>
    ),
    description: "Arithmetic mean of all observations",
  },
  {
    value: "rollingMean",
    label: "Rolling x̄",
    formula: (
      <span>
        x̄<sub>t</sub> = <sup>1</sup>&frasl;<sub>k</sub> &Sigma;
        <sub>i=t&minus;k+1</sub>
        <sup>t</sup> x<sub>i</sub>
      </span>
    ),
    description: "Backward-looking moving average",
  },
  {
    value: "stdDev",
    label: "±σ",
    formula: (
      <span>
        x̄ &plusmn; &sigma; where &sigma; = &radic;(&Sigma;(x
        <sub>i</sub> &minus; x̄)&sup2; / (n&minus;1))
      </span>
    ),
    description: "Full-sample mean ± 1 std dev (Bessel-corrected)",
  },
];

/** Overflow overlay items (in More dropdown) */
const MORE_OVERLAYS: Array<{
  value: string;
  label: string;
  formula: React.ReactNode;
  description: string;
}> = [
  {
    value: "rollingStdDev",
    label: "Rolling ±σ",
    formula: (
      <span>
        x̄<sub>t</sub> &plusmn; &sigma;<sub>t</sub>
      </span>
    ),
    description: "Rolling mean ± 1 sample std dev",
  },
  {
    value: "linearTrend",
    label: "Linear",
    formula: <span>ŷ = &alpha; + &beta;t</span>,
    description: "OLS linear trend",
  },
  {
    value: "logLinearTrend",
    label: "Log-Linear",
    formula: (
      <span>
        ŷ = e<sup>&alpha; + &beta;t</sup>
      </span>
    ),
    description: "Exponential trend via log-linear regression",
  },
  {
    value: "hpTrend",
    label: "HP Trend",
    formula: (
      <span>
        min<sub>&tau;</sub> &Sigma;(y<sub>t</sub> &minus; &tau;
        <sub>t</sub>)&sup2; + &lambda;&Sigma;(&Delta;&sup2; &tau;
        <sub>t</sub>)&sup2;
      </span>
    ),
    description: "Hodrick-Prescott filter (λ auto by frequency)",
  },
];

/** Primary transform items (shown inline) */
const PRIMARY_TRANSFORMS: Array<{
  value: Transformation;
  label: string;
  formula: React.ReactNode;
  description: string;
}> = [
  {
    value: "indexToYear",
    label: "Index",
    formula: (
      <span>
        y<sub>t</sub> = (x<sub>t</sub> / x<sub>base</sub>) &times; 100
      </span>
    ),
    description:
      "Index all values relative to the first observation in the base year",
  },
  {
    value: "yoy",
    label: "YOY %",
    formula: (
      <span>
        (x<sub>t</sub> &minus; x<sub>t&minus;4</sub>) / x<sub>t&minus;4</sub>{" "}
        &times; 100
      </span>
    ),
    description: "Year-over-year percent change",
  },
  {
    value: "ytd",
    label: "YTD %",
    formula: (
      <span>
        (x<sub>t</sub> &minus; x<sub>Jan</sub>) / x<sub>Jan</sub> &times; 100
      </span>
    ),
    description: "Year-to-date percent change from first period of year",
  },
  {
    value: "pop",
    label: "PoP %",
    formula: (
      <span>
        (x<sub>t</sub> &minus; x<sub>t&minus;1</sub>) / x<sub>t&minus;1</sub>{" "}
        &times; 100
      </span>
    ),
    description: "Period-over-period percent change",
  },
  {
    value: "levelChange",
    label: "LVL Chg",
    formula: (
      <span>
        &Delta;x<sub>t</sub> = x<sub>t</sub> &minus; x<sub>t&minus;1</sub>
      </span>
    ),
    description: "Absolute change from previous period",
  },
  {
    value: "cagr",
    label: "CAGR",
    formula: (
      <span>
        ((x<sub>n</sub>/x<sub>1</sub>)<sup>ppy/(n&minus;1)</sup> &minus; 1)
        &times; 100
      </span>
    ),
    description: "Compound annual growth rate",
  },
];

/** Overflow transform items (in More dropdown) */
const MORE_TRANSFORMS: Array<{
  value: string;
  label: string;
  formula: React.ReactNode;
  description: string;
}> = [
  {
    value: "zScore",
    label: "Z-Score",
    formula: (
      <span>
        z<sub>t</sub> = (x<sub>t</sub> &minus; x̄) / &sigma;
      </span>
    ),
    description: "Standard score: how many std devs from the mean",
  },
  {
    value: "deviationFromTrend",
    label: "Dev. from Trend",
    formula: (
      <span>
        d<sub>t</sub> = x<sub>t</sub> &minus; (&alpha; + &beta;t)
      </span>
    ),
    description: "Residual from OLS linear trend",
  },
  {
    value: "logLevel",
    label: "Log Level",
    formula: (
      <span>
        y<sub>t</sub> = ln(x<sub>t</sub>), x &gt; 0
      </span>
    ),
    description: "Natural logarithm of level values",
  },
];

/** Single axis column — controls overlays, transform, and chart type for one axis */
/** Compact inline select for choosing from a list of values */
function InlineSelect({
  value,
  options,
  onChange,
  formatOption,
  className,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  formatOption?: (v: string) => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fmt = formatOption ?? ((v: string) => v);

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (o) =>
        o.toLowerCase().includes(lower) || fmt(o).toLowerCase().includes(lower),
    );
  }, [options, search, fmt]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "border-input bg-background hover:bg-accent inline-flex h-5 cursor-pointer items-center gap-0.5 rounded border px-1 font-mono text-[11px] transition-colors",
            className,
          )}
        >
          {fmt(value)}
          <ChevronsUpDown className="h-2.5 w-2.5 opacity-50" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-44 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {options.length > 10 && (
          <div className="p-1.5">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              className={cn(
                "hover:bg-accent flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-xs",
                value === opt && "bg-accent font-medium",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt);
                setSearch("");
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "h-3 w-3 shrink-0",
                  value === opt ? "opacity-100" : "opacity-0",
                )}
              />
              {fmt(opt)}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-2 text-center text-xs">
              No matches
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AxisColumn({
  overlays,
  onOverlaysChange,
  transform,
  onTransformChange,
  chartType,
  onChartTypeChange,
  indexBaseDate,
  onIndexBaseDateChange,
  availableDates,
  rollingWindow,
  onRollingWindowChange,
  stdDevMultiplier,
  onStdDevMultiplierChange,
  freqCode,
  stats,
  fmtMean,
  showChangeTransforms,
  showOverlays = true,
  showChartType = true,
}: {
  overlays: Overlay[];
  onOverlaysChange: (overlays: Overlay[]) => void;
  transform: Transformation | null;
  onTransformChange: (t: Transformation | null) => void;
  chartType: "line" | "column";
  onChartTypeChange: (v: "line" | "column") => void;
  indexBaseDate: string;
  onIndexBaseDateChange: (date: string) => void;
  availableDates: string[];
  rollingWindow: number;
  onRollingWindowChange: (k: number) => void;
  stdDevMultiplier: number;
  onStdDevMultiplierChange: (m: number) => void;
  freqCode?: string | null;
  stats?: {
    mean: number;
    median: number | null;
    standardDeviation: number;
  } | null;
  fmtMean?: (v: number) => string;
  showChangeTransforms?: boolean;
  showOverlays?: boolean;
  showChartType?: boolean;
}) {
  const overlaySet = useMemo(() => new Set<string>(overlays), [overlays]);
  const transformSet = useMemo(
    () => new Set<string>(transform ? [transform] : []),
    [transform],
  );

  const handleOverlayToggle = useCallback(
    (value: string) => {
      const v = value as Overlay;
      if (overlays.includes(v)) {
        onOverlaysChange(overlays.filter((o) => o !== v));
      } else {
        onOverlaysChange([...overlays, v]);
      }
    },
    [overlays, onOverlaysChange],
  );

  const handleOverlayGroupChange = useCallback(
    (values: string[]) => {
      if (values.includes("none") && overlays.length > 0) {
        onOverlaysChange([]);
        return;
      }
      onOverlaysChange(values.filter((v) => v !== "none") as Overlay[]);
    },
    [overlays, onOverlaysChange],
  );

  const handleTransformGroupChange = useCallback(
    (values: string[]) => {
      if (values.includes("none") && transform !== null) {
        onTransformChange(null);
        return;
      }
      const real = values.filter((v) => v !== "none") as Transformation[];
      if (real.length === 0) {
        onTransformChange(null);
        return;
      }
      onTransformChange(real.find((v) => v !== transform) ?? real[0]);
    },
    [transform, onTransformChange],
  );

  const handleTransformToggle = useCallback(
    (value: string) => {
      const v = value as Transformation;
      if (transform === v) onTransformChange(null);
      else onTransformChange(v);
    },
    [transform, onTransformChange],
  );

  // Show separate rolling window row only for rollingMean transform
  // (overlay cases have inline inputs: rollingMean overlay in toggle, rollingStdDev in More dropdown)
  const showRollingWindowRow =
    transform === "rollingMean" && !overlays.includes("rollingMean");

  const dataPPY = PERIODS_PER_YEAR[freqCode ?? "M"] ?? 12;
  const windowPresets = useMemo(
    () =>
      [
        { label: "W", ppy: 52 },
        { label: "M", ppy: 12 },
        { label: "Q", ppy: 4 },
        { label: "S", ppy: 2 },
        { label: "A", ppy: 1 },
      ]
        .map((p) => ({ ...p, k: Math.round(dataPPY / p.ppy) }))
        .filter((p) => p.k >= 2),
    [dataPPY],
  );

  const visibleTransforms =
    showChangeTransforms !== false
      ? PRIMARY_TRANSFORMS
      : PRIMARY_TRANSFORMS.filter(
          (t) =>
            !["yoy", "ytd", "pop", "levelChange", "cagr"].includes(t.value),
        );

  return (
    <div className="flex flex-col gap-2">
      {/* Chart type row */}
      {showChartType && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground w-14 shrink-0 text-[10px] font-medium">
            Chart
          </span>
          <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
        </div>
      )}

      {/* Overlays row */}
      {showOverlays && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground w-14 shrink-0 text-[10px] font-medium">
            Overlays
          </span>
          <ToggleGroup
            type="multiple"
            value={overlays.length === 0 ? ["none"] : overlays}
            onValueChange={handleOverlayGroupChange}
            variant="default"
            size="sm"
          >
            <ToggleGroupItem value="none" className="h-6 px-2 text-[11px]">
              None
            </ToggleGroupItem>
            {PRIMARY_OVERLAYS.map((item) => (
              <TooltipToggleItem
                key={item.value}
                value={item.value}
                className="h-6 px-2 text-[11px]"
                formula={item.formula}
                description={item.description}
              >
                {item.value === "mean" && stats && fmtMean ? (
                  <>
                    <span className="text-muted-foreground">x̄</span>
                    <span className="font-mono">{fmtMean(stats.mean)}</span>
                  </>
                ) : item.value === "stdDev" ? (
                  <>
                    <span className="text-muted-foreground">
                      &plusmn;&sigma;
                    </span>
                    {overlays.includes("stdDev") && (
                      <InlineSelect
                        value={String(stdDevMultiplier)}
                        options={["1", "2"]}
                        onChange={(v) =>
                          onStdDevMultiplierChange(parseInt(v, 10))
                        }
                        formatOption={(v) => `${v}σ`}
                      />
                    )}
                  </>
                ) : item.value === "rollingMean" ? (
                  <>
                    <span className="text-muted-foreground">{item.label}</span>
                    {overlays.includes("rollingMean") &&
                      windowPresets.length > 0 && (
                        <InlineSelect
                          value={String(rollingWindow)}
                          options={windowPresets.map((p) => String(p.k))}
                          onChange={(v) =>
                            onRollingWindowChange(parseInt(v, 10))
                          }
                          formatOption={(v) => {
                            const preset = windowPresets.find(
                              (p) => String(p.k) === v,
                            );
                            return preset
                              ? `k=${v} (${preset.label})`
                              : `k=${v}`;
                          }}
                        />
                      )}
                  </>
                ) : (
                  <span className="text-muted-foreground">{item.label}</span>
                )}
              </TooltipToggleItem>
            ))}
          </ToggleGroup>
          <MoreDropdown
            items={MORE_OVERLAYS}
            activeValues={overlaySet}
            onToggle={handleOverlayToggle}
            renderItemExtra={(value) => {
              if (value === "rollingStdDev") {
                return (
                  <div className="flex items-center gap-2 px-2 pb-1.5 pl-8">
                    {windowPresets.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-[10px]">
                          k
                        </span>
                        <InlineSelect
                          value={String(rollingWindow)}
                          options={windowPresets.map((p) => String(p.k))}
                          onChange={(v) =>
                            onRollingWindowChange(parseInt(v, 10))
                          }
                          formatOption={(v) => {
                            const preset = windowPresets.find(
                              (p) => String(p.k) === v,
                            );
                            return preset ? `${v} (${preset.label})` : `k=${v}`;
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-[10px]">
                        σ
                      </span>
                      <InlineSelect
                        value={String(stdDevMultiplier)}
                        options={["1", "2"]}
                        onChange={(v) =>
                          onStdDevMultiplierChange(parseInt(v, 10))
                        }
                        formatOption={(v) => `${v}σ`}
                      />
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
        </div>
      )}

      {/* Transform row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground w-14 shrink-0 text-[10px] font-medium">
          Transform
        </span>
        <ToggleGroup
          type="multiple"
          value={transform ? [transform] : ["none"]}
          onValueChange={handleTransformGroupChange}
          variant="default"
          size="sm"
        >
          <ToggleGroupItem value="none" className="h-6 px-2 text-[11px]">
            None
          </ToggleGroupItem>
          {visibleTransforms.map((item) => (
            <TooltipToggleItem
              key={item.value}
              value={item.value}
              className="h-6 px-2 text-[11px]"
              formula={item.formula}
              description={item.description}
            >
              {item.label}
              {item.value === "indexToYear" &&
                transform === "indexToYear" &&
                availableDates.length > 0 && (
                  <InlineSelect
                    value={indexBaseDate}
                    options={availableDates}
                    onChange={onIndexBaseDateChange}
                    formatOption={(d) => formatFreqDate(d, freqCode)}
                  />
                )}
            </TooltipToggleItem>
          ))}
        </ToggleGroup>
        <MoreDropdown
          items={MORE_TRANSFORMS}
          activeValues={transformSet}
          onToggle={handleTransformToggle}
        />
      </div>

      {/* Rolling window k (shown for rollingMean transform when not available inline) */}
      {showRollingWindowRow && windowPresets.length > 0 && (
        <div className="flex items-center gap-1.5 pl-14">
          <span className="text-muted-foreground text-[10px]">k =</span>
          <InlineSelect
            value={String(rollingWindow)}
            options={windowPresets.map((p) => String(p.k))}
            onChange={(v) => onRollingWindowChange(parseInt(v, 10))}
            formatOption={(v) => {
              const preset = windowPresets.find((p) => String(p.k) === v);
              return preset ? `${v} (${preset.label})` : v;
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main controls component                                            */
/* ------------------------------------------------------------------ */

interface AnalyzeControlsProps {
  decimals: number;
  unitShortLabel?: string | null;
  currentFreqCode?: string | null;
  compareSeries: Array<{
    name: string;
    data: [string, number][];
    unitShortLabel?: string | null;
  }>;
  /** Universe slug for building URLs */
  universe?: string;
  /** Timeline events for chart overlays */
  timelineEvents?: TimelineEventForChart[];
  /** Externally-controlled visibility state */
  controlledVisibility?: Map<number, "gray" | "hidden">;
  /** Externally-controlled axis assignments */
  controlledAxes?: Map<number, "left" | "right">;
  /** Which compareSeries index to show stats for (default 0) */
  selectedStatsSeriesIndex?: number;
  /** Analyzer entries for inline series list */
  entries?: AnalyzerEntry[];
  selectedStatsId?: string | null;
  onSelectStats?: (id: string) => void;
  onExpressionChange?: (id: string, expression: string) => void;
  onVisibilityChange?: (id: string, visibility: AnalyzerEntry["visibility"]) => void;
  onAxisChange?: (id: string, axis: "left" | "right") => void;
  onRemove?: (id: string) => void;
  onAddCompareYoY?: (id: string) => void;
}

export function AnalyzeControls({
  decimals,
  unitShortLabel,
  currentFreqCode,
  compareSeries: compareSeriesData,
  universe,
  timelineEvents = [],
  controlledVisibility,
  controlledAxes,
  selectedStatsSeriesIndex,
  entries,
  selectedStatsId,
  onSelectStats,
  onExpressionChange,
  onVisibilityChange,
  onAxisChange,
  onRemove,
  onAddCompareYoY,
}: AnalyzeControlsProps) {

  const searchParams = useSearchParams();

  const seriesVisibility = controlledVisibility ?? new Map<number, "gray" | "hidden">();

  const [barMode, setBarMode] = useState<BarMode>(() =>
    parseBarMode(searchParams.get("barMode")),
  );
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    parseOverlays(searchParams.get("overlays")),
  );
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(
    () => parseEventTypes(searchParams.get("events")),
  );
  const [transformation, setTransformation] = useState<Transformation | null>(
    () => parseTransformation(searchParams.get("transform")),
  );
  // Right axis state (replaces old secondAxis toggle)
  const [rightOverlays, setRightOverlays] = useState<Overlay[]>(() =>
    parseOverlays(searchParams.get("rightOverlays")),
  );
  const [rightTransformation, setRightTransformation] =
    useState<Transformation | null>(() =>
      parseTransformation(searchParams.get("secondAxisTransform")),
    );
  const [rollingWindow, setRollingWindow] = useState(() => {
    const v = parseInt(searchParams.get("rollingWindow") ?? "", 10);
    return !isNaN(v) && v >= 2 ? v : 12;
  });
  const [indexBaseDate, setIndexBaseDate] = useState(() => {
    return searchParams.get("indexDate") ?? "";
  });
  const [stdDevMultiplier, setStdDevMultiplier] = useState(() => {
    const v = parseInt(searchParams.get("stdDevMultiplier") ?? "", 10);
    return v >= 1 && v <= 2 ? v : 1;
  });
  // Chart type per axis (line or column)
  const [leftChartType, setLeftChartType] = useState<"line" | "column">(() => {
    const v = searchParams.get("leftChartType");
    return v === "column" ? "column" : "line";
  });
  const [rightChartType, setRightChartType] = useState<"line" | "column">(
    () => {
      const v = searchParams.get("rightChartType");
      return v === "column" ? "column" : "line";
    },
  );

  // Selected events filtered from all timeline events by type
  const selectedEvents = useMemo(
    () => timelineEvents.filter((e) => selectedEventTypes.has(e.eventType)),
    [timelineEvents, selectedEventTypes],
  );

  // ── Merge all series into unified chart rows ────────────────────────
  const chartData = useMemo(() => {
    const dateSet = new Map<string, ChartRow>();
    for (let s = 0; s < compareSeriesData.length; s++) {
      for (const [date, value] of compareSeriesData[s].data) {
        if (!dateSet.has(date)) {
          dateSet.set(date, {
            date,
            level: null,
            levelChange: null,
            yoy: null,
            ytd: null,
            pop: null,
            cagr: null,
          });
        }
        const row = dateSet.get(date)!;
        (row as unknown as Record<string, unknown>)[`series_${s}`] = value;
      }
    }
    return [...dateSet.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [compareSeriesData]);

  const compareSeriesNames = useMemo(
    () => compareSeriesData.map((s) => s.name),
    [compareSeriesData],
  );

  /** Group visible (non-hidden) series indices by unit label */
  const compareUnits = useMemo(() => {
    const map = new Map<string, number[]>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      const label = compareSeriesData[i].unitShortLabel ?? "—";
      const indices = map.get(label);
      if (indices) indices.push(i);
      else map.set(label, [i]);
    }
    return [...map.entries()]; // [label, seriesIndices[]]
  }, [compareSeriesData, seriesVisibility]);

  const axisOverrides = controlledAxes ?? new Map<number, "left" | "right">();

  /** Auto-default axis assignment based on unit groups */
  const autoAxisMap = useMemo(() => {
    const map = new Map<number, "left" | "right">();
    if (compareUnits.length === 2) {
      for (const idx of compareUnits[0][1]) map.set(idx, "left");
      for (const idx of compareUnits[1][1]) map.set(idx, "right");
    } else {
      for (const [, indices] of compareUnits) {
        for (const idx of indices) map.set(idx, "left");
      }
    }
    return map;
  }, [compareUnits]);

  /** Merged axis map: user overrides take precedence over auto-defaults */
  const seriesAxisMap = useMemo(() => {
    const map = new Map(autoAxisMap);
    for (const [idx, axis] of axisOverrides) {
      if (map.has(idx)) map.set(idx, axis);
    }
    return map;
  }, [autoAxisMap, axisOverrides]);

  const hasRightAxis = useMemo(
    () => [...seriesAxisMap.values()].some((v) => v === "right"),
    [seriesAxisMap],
  );

  /** Collect distinct unit labels for each axis side */
  const leftAxisLabel = useMemo(() => {
    if (!hasRightAxis) return undefined;
    const labels = new Set<string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "left")
        labels.add(compareSeriesData[i].unitShortLabel ?? "—");
    }
    return [...labels].join(", ") || undefined;
  }, [hasRightAxis, compareSeriesData, seriesAxisMap, seriesVisibility]);

  const rightAxisLabel = useMemo(() => {
    if (!hasRightAxis) return undefined;
    const labels = new Set<string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "right")
        labels.add(compareSeriesData[i].unitShortLabel ?? "—");
    }
    return [...labels].join(", ") || undefined;
  }, [hasRightAxis, compareSeriesData, seriesAxisMap, seriesVisibility]);

  /** Map series index → unit short label for tooltip display */
  const seriesUnitLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      map.set(i, compareSeriesData[i].unitShortLabel ?? "");
    }
    return map;
  }, [compareSeriesData]);

  const endIdx = Math.max(0, chartData.length - 1);
  const [rangePreset, setRangePreset] = useState(() => {
    const v = searchParams.get("range");
    if (v) {
      const preset = RANGE_PRESETS.find((p) => p.label === v);
      if (preset) return v;
    }
    // If custom rangeStart/rangeEnd are in URL, no preset is active
    if (searchParams.get("rangeStart") || searchParams.get("rangeEnd"))
      return "";
    return DEFAULT_RANGE_PRESET;
  });
  const [brushRange, setBrushRange] = useState<{
    startIndex: number;
    endIndex: number;
  }>(() => {
    // First check for preset
    const rangeParam = searchParams.get("range");
    if (rangeParam) {
      const preset = RANGE_PRESETS.find((p) => p.label === rangeParam);
      if (preset) {
        return {
          startIndex: getRangeStartIndex(chartData, preset.years),
          endIndex: endIdx,
        };
      }
    }
    // Then check for custom date range
    const rangeStart = searchParams.get("rangeStart");
    const rangeEnd = searchParams.get("rangeEnd");
    if (rangeStart || rangeEnd) {
      let startIndex = 0;
      let endIndex = endIdx;
      if (rangeStart) {
        for (let i = 0; i < chartData.length; i++) {
          if (chartData[i].date >= rangeStart) {
            startIndex = i;
            break;
          }
        }
      }
      if (rangeEnd) {
        for (let i = chartData.length - 1; i >= 0; i--) {
          if (chartData[i].date <= rangeEnd) {
            endIndex = i;
            break;
          }
        }
      }
      return { startIndex, endIndex };
    }
    return {
      startIndex: getRangeStartIndex(chartData, DEFAULT_RANGE_YEARS),
      endIndex: endIdx,
    };
  });

  // Fingerprint of the data composition — changes when series are added/removed
  // or when switching to a different series in analyze mode
  const chartDataFingerprint = useMemo(() => {
    if (chartData.length === 0) return "";
    return `${chartData.length}|${chartData[0].date}|${chartData[chartData.length - 1].date}`;
  }, [chartData]);

  const prevFingerprint = useRef(chartDataFingerprint);
  useEffect(() => {
    if (prevFingerprint.current === chartDataFingerprint) return;
    prevFingerprint.current = chartDataFingerprint;

    const newEndIdx = Math.max(0, chartData.length - 1);
    if (rangePreset) {
      // Re-apply active preset to the new data
      const preset = RANGE_PRESETS.find((p) => p.label === rangePreset);
      const years = preset?.years ?? DEFAULT_RANGE_YEARS;
      setBrushRange({
        startIndex: getRangeStartIndex(chartData, years),
        endIndex: newEndIdx,
      });
    } else {
      // Custom range — clamp indices to valid bounds, reset to full range
      // if clamping would produce a degenerate (zero-width) range
      setBrushRange((prev) => {
        const start = Math.min(prev.startIndex, newEndIdx);
        const end = Math.min(prev.endIndex, newEndIdx);
        if (start >= end) {
          return {
            startIndex: getRangeStartIndex(chartData, DEFAULT_RANGE_YEARS),
            endIndex: newEndIdx,
          };
        }
        return { startIndex: start, endIndex: end };
      });
    }
  }, [chartDataFingerprint, chartData, rangePreset]);

  const handlePresetClick = useCallback(
    (years: number, label: string) => {
      const startIndex = getRangeStartIndex(chartData, years);
      setBrushRange({ startIndex, endIndex: endIdx });
      setRangePreset(label);
    },
    [chartData, endIdx],
  );

  const brushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (brushTimer.current) clearTimeout(brushTimer.current);
      brushTimer.current = setTimeout(() => {
        setRangePreset("");
        setBrushRange((prev) => ({
          startIndex: range.startIndex ?? prev.startIndex,
          endIndex: range.endIndex ?? prev.endIndex,
        }));
      }, 120);
    },
    [],
  );

  // Derive custom range dates from brush indices (for URL sync)
  const brushStartDate = chartData[brushRange.startIndex]?.date;
  const brushEndDate = chartData[brushRange.endIndex]?.date;

  // ── Sync chart state → URL search params ────────────────────────────
  useEffect(() => {
    syncParamsToUrl({
      overlays: overlays.length > 0 ? overlays.join(",") : undefined,
      events:
        selectedEventTypes.size > 0
          ? [...selectedEventTypes].join(",")
          : undefined,
      transform: transformation ?? undefined,
      secondAxisTransform: rightTransformation ?? undefined,
      rightOverlays:
        rightOverlays.length > 0 ? rightOverlays.join(",") : undefined,
      barMode: barMode !== "yoy" ? barMode : undefined,
      rollingWindow: rollingWindow !== 12 ? String(rollingWindow) : undefined,
      indexDate: indexBaseDate || undefined,
      range:
        rangePreset && rangePreset !== DEFAULT_RANGE_PRESET
          ? rangePreset
          : undefined,
      // Custom brush range (only when no preset is active)
      rangeStart: !rangePreset ? brushStartDate : undefined,
      rangeEnd: !rangePreset ? brushEndDate : undefined,
      stdDevMultiplier:
        stdDevMultiplier !== 1 ? String(stdDevMultiplier) : undefined,
      leftChartType: leftChartType !== "line" ? leftChartType : undefined,
      rightChartType: rightChartType !== "line" ? rightChartType : undefined,
    });
  }, [
    overlays,
    selectedEventTypes,
    transformation,
    rightTransformation,
    rightOverlays,
    barMode,
    rollingWindow,
    indexBaseDate,
    rangePreset,
    brushStartDate,
    brushEndDate,
    stdDevMultiplier,
    leftChartType,
    rightChartType,
  ]);

  // ── Available dates from brush-selected range ─────────────────────
  const availableDates = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    return sliced
      .filter((r) => {
        for (let s = 0; s < compareSeriesNames.length; s++) {
          const v = r[`series_${s}` as keyof typeof r];
          if (v != null) return true;
        }
        return false;
      })
      .map((r) => r.date);
  }, [chartData, brushRange, compareSeriesNames.length]);

  // Effective index base date: use user selection, fall back to median
  const effectiveIndexBaseDate = useMemo(() => {
    if (indexBaseDate && availableDates.includes(indexBaseDate))
      return indexBaseDate;
    if (availableDates.length === 0) return "";
    return availableDates[Math.floor(availableDates.length / 2)];
  }, [indexBaseDate, availableDates]);

  // Derive year from date for the transformation functions
  const indexBaseYear = useMemo(() => {
    if (!effectiveIndexBaseDate) return 2015;
    return parseInt(effectiveIndexBaseDate.slice(0, 4), 10);
  }, [effectiveIndexBaseDate]);

  // ── Full data with per-axis transforms (for chart + brush) ──────────
  const compareFullData = useMemo(() => {
    // Apply left-axis transform to all series
    let rows = applyTransformationMulti(
      chartData,
      transformation,
      compareSeriesNames.length,
      indexBaseYear,
      rollingWindow,
      effectiveIndexBaseDate,
      currentFreqCode,
    );

    // If right axis has a different transform, overwrite right-axis series
    if (rightTransformation !== transformation) {
      const rightRows = applyTransformationMulti(
        chartData,
        rightTransformation,
        compareSeriesNames.length,
        indexBaseYear,
        rollingWindow,
        effectiveIndexBaseDate,
        currentFreqCode,
      );
      // Overwrite only the right-axis series columns
      for (let s = 0; s < compareSeriesNames.length; s++) {
        if (seriesAxisMap.get(s) === "right") {
          const key = `series_${s}` as keyof ChartRow;
          rows = rows.map((row, i) => ({
            ...row,
            [key]: rightRows[i]?.[key] ?? null,
          }));
        }
      }
    }

    return rows;
  }, [
    chartData,
    transformation,
    rightTransformation,
    compareSeriesNames.length,
    seriesAxisMap,
    indexBaseYear,
    rollingWindow,
    effectiveIndexBaseDate,
    currentFreqCode,
  ]);

  // ── Visible series counts per axis ──────────────────────────────────
  const leftVisibleCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < compareSeriesNames.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if ((seriesAxisMap.get(i) ?? "left") === "left") count++;
    }
    return count;
  }, [compareSeriesNames.length, seriesVisibility, seriesAxisMap]);

  const rightVisibleCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < compareSeriesNames.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "right") count++;
    }
    return count;
  }, [compareSeriesNames.length, seriesVisibility, seriesAxisMap]);

  // First visible series index on left axis (for overlay computation)
  const leftFirstVisibleIndex = useMemo(() => {
    for (let i = 0; i < compareSeriesNames.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if ((seriesAxisMap.get(i) ?? "left") === "left") return i;
    }
    return -1;
  }, [compareSeriesNames.length, seriesVisibility, seriesAxisMap]);

  // Apply overlays on the first visible left-axis series (only when 1 visible)
  const compareFullDataWithOverlays = useMemo(() => {
    if (compareFullData.length === 0) return compareFullData;
    if (leftVisibleCount === 1 && overlays.length > 0 && leftFirstVisibleIndex >= 0) {
      return computeOverlaysMulti(
        compareFullData,
        overlays,
        leftFirstVisibleIndex,
        rollingWindow,
        stdDevMultiplier,
      );
    }
    return compareFullData;
  }, [
    compareFullData,
    leftVisibleCount,
    overlays,
    leftFirstVisibleIndex,
    rollingWindow,
    stdDevMultiplier,
  ]);

  // ── Table data preserving original levels ────────────────────────────
  const tableData = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    if (!transformation && !rightTransformation) return sliced;

    // Apply transforms to FULL data so lookback periods (YoY, etc.) work
    const leftTransformed = transformation
      ? applyTransformationMulti(
          chartData,
          transformation,
          compareSeriesNames.length,
          indexBaseYear,
          rollingWindow,
          effectiveIndexBaseDate,
          currentFreqCode,
        )
      : null;

    const rightTransformed =
      rightTransformation && rightTransformation !== transformation
        ? applyTransformationMulti(
            chartData,
            rightTransformation,
            compareSeriesNames.length,
            indexBaseYear,
            rollingWindow,
            effectiveIndexBaseDate,
            currentFreqCode,
          )
        : null;

    return sliced.map((row, ri) => {
      const fullIndex = brushRange.startIndex + ri;
      const result = { ...row };
      for (let s = 0; s < compareSeriesNames.length; s++) {
        const sKey = `series_${s}` as const;
        const isRight = seriesAxisMap.get(s) === "right";
        const source = isRight
          ? (rightTransformed ?? leftTransformed)
          : leftTransformed;
        const tx = isRight ? rightTransformation : transformation;
        if (source && tx) {
          (result as unknown as Record<string, unknown>)[`transformed_${s}`] =
            source[fullIndex][sKey];
        }
      }
      return result;
    });
  }, [
    chartData,
    brushRange,
    transformation,
    rightTransformation,
    compareSeriesNames.length,
    seriesAxisMap,
    indexBaseYear,
    rollingWindow,
    effectiveIndexBaseDate,
    currentFreqCode,
  ]);

  // Summary stats for the brush-selected range (selected series)
  const rangeStats = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    const sKey = `series_${selectedStatsSeriesIndex ?? 0}` as keyof (typeof sliced)[0];
    const levels = sliced
      .map((r) => r[sKey] as number)
      .filter((v): v is number => v != null && !isNaN(v));
    if (levels.length === 0) return null;
    const n = levels.length;
    const mean = levels.reduce((a, b) => a + b, 0) / n;
    const sorted = [...levels].sort((a, b) => a - b);
    const median =
      n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    let sumSq = 0;
    for (const v of levels) sumSq += (v - mean) ** 2;
    const stdDev = n > 1 ? Math.sqrt(sumSq / (n - 1)) : 0;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const total = levels.reduce((a, b) => a + b, 0);
    const first = levels[0];
    const last = levels[levels.length - 1];
    const change = last - first;
    const pctChange =
      first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
    // CAGR: ((last/first)^(periodsPerYear / (n-1)) - 1) * 100
    const ppy = PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12;
    const cagr =
      n > 1 && first > 0 && last > 0
        ? (Math.pow(last / first, ppy / (n - 1)) - 1) * 100
        : null;
    // Date range
    const startDate = sliced[0]?.date ?? "";
    const endDate = sliced[sliced.length - 1]?.date ?? "";
    return {
      mean,
      median,
      stdDev,
      n,
      min,
      max,
      total,
      change,
      pctChange,
      cagr,
      startDate,
      endDate,
    };
  }, [chartData, brushRange, currentFreqCode, selectedStatsSeriesIndex]);

  // Stats in the shape expected by OverlaysToggle and LevelChart, derived from selected range
  const chartStats = useMemo(
    () =>
      rangeStats
        ? {
            mean: rangeStats.mean,
            median: rangeStats.median,
            standardDeviation: rangeStats.stdDev,
          }
        : null,
    [rangeStats],
  );

  const fmt = (v: number) => formatLevel(v, decimals, unitShortLabel);

  return (
      <div className="flex flex-col gap-3">
        {/* Stats & range bar */}
        <div className="flex items-start justify-between gap-6 py-1">
          <div className="grid grid-cols-5 gap-x-5 gap-y-1">
            <StatCell
              label="Mean"
              value={rangeStats ? fmt(rangeStats.mean) : "—"}
            />
            <StatCell
              label="Median"
              value={rangeStats ? fmt(rangeStats.median) : "—"}
            />
            <StatCell
              label="Std Dev"
              value={rangeStats ? fmt(rangeStats.stdDev) : "—"}
            />
            <StatCell
              label="Min"
              value={rangeStats ? fmt(rangeStats.min) : "—"}
            />
            <StatCell
              label="Max"
              value={rangeStats ? fmt(rangeStats.max) : "—"}
            />
            <StatCell
              label="Total"
              value={rangeStats ? fmt(rangeStats.total) : "—"}
            />
            <StatCell
              label="Change"
              value={rangeStats ? fmt(rangeStats.change) : "—"}
            />
            <StatCell
              label="% Change"
              value={
                rangeStats?.pctChange != null
                  ? `${rangeStats.pctChange.toFixed(2)}%`
                  : "—"
              }
            />
            <StatCell
              label="CAGR"
              value={
                rangeStats?.cagr != null
                  ? `${rangeStats.cagr.toFixed(2)}%`
                  : "—"
              }
            />
            <StatCell
              label="Obs"
              value={rangeStats ? String(rangeStats.n) : "—"}
            />
          </div>
          <Separator orientation="vertical" className="h-auto self-stretch" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {RANGE_PRESETS.filter(
                  (p) =>
                    p.minPPY <=
                    (PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12),
                ).map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetClick(p.years, p.label)}
                    className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      rangePreset === p.label
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground bg-transparent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {rangeStats && (
              <div className="flex items-center gap-1.5">
                <FreqDateInput
                  dateStr={rangeStats.startDate}
                  freqCode={currentFreqCode}
                  onCommit={(iso) => {
                    const idx = findClosestDateIndex(chartData, iso, "start");
                    setBrushRange((prev) => ({
                      startIndex: Math.min(idx, prev.endIndex),
                      endIndex: prev.endIndex,
                    }));
                    setRangePreset("");
                  }}
                />
                <span className="text-muted-foreground text-sm">—</span>
                <FreqDateInput
                  dateStr={rangeStats.endDate}
                  freqCode={currentFreqCode}
                  onCommit={(iso) => {
                    const idx = findClosestDateIndex(chartData, iso, "end");
                    setBrushRange((prev) => ({
                      startIndex: prev.startIndex,
                      endIndex: Math.max(idx, prev.startIndex),
                    }));
                    setRangePreset("");
                  }}
                />
              </div>
            )}
          </div>
          {timelineEvents.length > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="h-auto self-stretch"
              />
              <TimelineControl
                timelineEvents={timelineEvents}
                selectedEventTypes={selectedEventTypes}
                onSelectedEventTypesChange={setSelectedEventTypes}
              />
            </>
          )}
          <Separator orientation="vertical" className="h-auto self-stretch" />
          {/* Units for compared series */}
          <div className="flex min-w-32 flex-col gap-1">
            <span className="text-muted-foreground text-xs">Units</span>
            <div className="flex flex-wrap gap-2">
              {compareUnits.map(([label, indices]) => {
                // Determine which axes this unit group spans
                const axes = new Set(
                  indices.map((i) => seriesAxisMap.get(i) ?? "left"),
                );
                const axisTags = hasRightAxis
                  ? [...axes].map((a) => (a === "left" ? "L" : "R")).join(",")
                  : null;
                return (
                  <span
                    key={label}
                    className="flex items-center gap-1 text-sm font-medium"
                  >
                    {compareUnits.length > 1 &&
                      indices.map((i) => (
                        <span
                          key={i}
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              SERIES_COLORS[i % SERIES_COLORS.length],
                          }}
                        />
                      ))}
                    {label}
                    {axisTags && (
                      <span className="text-muted-foreground text-[10px] font-normal">
                        ({axisTags})
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
          {compareUnits.length > 2 && !hasRightAxis && (
            <div className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                Series with mismatched units share a single axis
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Combined axis panels: series list + controls */}
        {(() => {
          const leftEntries = entries?.filter((e) => e.axis !== "right") ?? [];
          const rightEntries = entries?.filter((e) => e.axis === "right") ?? [];

          // Build stable color map from entries
          const colorMap = new Map<string, string>();
          entries?.forEach((e, i) => {
            colorMap.set(e.id, SERIES_COLORS[i % SERIES_COLORS.length]);
          });

          const renderSeriesList = (axisEntries: AnalyzerEntry[]) =>
            axisEntries.length > 0 ? (
              <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
                {axisEntries.map((entry) => (
                  <AnalyzerSeriesRow
                    key={entry.id}
                    entry={entry}
                    color={colorMap.get(entry.id) ?? SERIES_COLORS[0]}
                    isStatsSelected={selectedStatsId === entry.id}
                    onSelectStats={onSelectStats}
                    onExpressionChange={onExpressionChange ?? (() => {})}
                    onVisibilityChange={onVisibilityChange ?? (() => {})}
                    onAxisChange={onAxisChange ?? (() => {})}
                    onRemove={onRemove ?? (() => {})}
                    onCompareYoY={
                      onAddCompareYoY
                        ? (id: string) => {
                            setRightChartType("column");
                            setRightTransformation("yoy");
                            onAddCompareYoY(id);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground px-1 text-xs italic">
                No series
              </span>
            );

          return (
            <div className="grid grid-cols-2 gap-4">
              {/* Left Axis panel */}
              <div className="flex flex-col gap-2 rounded-md border p-2">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Left Axis
                </span>
                {entries && renderSeriesList(leftEntries)}
                <Separator />
                <AxisColumn
                  overlays={overlays}
                  onOverlaysChange={setOverlays}
                  transform={transformation}
                  onTransformChange={setTransformation}
                  chartType={leftChartType}
                  onChartTypeChange={setLeftChartType}
                  indexBaseDate={effectiveIndexBaseDate}
                  onIndexBaseDateChange={setIndexBaseDate}
                  availableDates={availableDates}
                  rollingWindow={rollingWindow}
                  onRollingWindowChange={setRollingWindow}
                  stdDevMultiplier={stdDevMultiplier}
                  onStdDevMultiplierChange={setStdDevMultiplier}
                  freqCode={currentFreqCode}
                  stats={chartStats}
                  fmtMean={fmt}
                  showOverlays={leftVisibleCount <= 1}
                />
              </div>
              {/* Right Axis panel */}
              <div className="flex flex-col gap-2 rounded-md border p-2">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Right Axis
                </span>
                {entries && renderSeriesList(rightEntries)}
                <Separator />
                <AxisColumn
                  overlays={rightOverlays}
                  onOverlaysChange={setRightOverlays}
                  transform={rightTransformation}
                  onTransformChange={setRightTransformation}
                  chartType={rightChartType}
                  onChartTypeChange={setRightChartType}
                  indexBaseDate={effectiveIndexBaseDate}
                  onIndexBaseDateChange={setIndexBaseDate}
                  availableDates={availableDates}
                  rollingWindow={rollingWindow}
                  onRollingWindowChange={setRollingWindow}
                  stdDevMultiplier={stdDevMultiplier}
                  onStdDevMultiplierChange={setStdDevMultiplier}
                  freqCode={currentFreqCode}
                  stats={chartStats}
                  fmtMean={fmt}
                  showOverlays={rightVisibleCount <= 1}
                />
              </div>
            </div>
          );
        })()}

        {/* Multi-series level chart with brush */}
        <div className="w-full py-2">
          <LevelChart
            data={compareFullDataWithOverlays}
            decimals={decimals}
            freqCode={currentFreqCode}
            seriesNames={compareSeriesNames}
            seriesVisibility={seriesVisibility}
            seriesAxisMap={seriesAxisMap}
            leftAxisLabel={leftAxisLabel}
            rightAxisLabel={rightAxisLabel}
            seriesUnitLabels={seriesUnitLabels}
            selectedEvents={selectedEvents}
            overlays={leftVisibleCount === 1 ? overlays : []}
            stats={leftVisibleCount === 1 ? chartStats ?? undefined : undefined}
            unitShortLabel={unitShortLabel}
            stdDevMultiplier={stdDevMultiplier}
            brushStartIndex={brushRange.startIndex}
            brushEndIndex={brushRange.endIndex}
            onBrushChange={handleBrushChange}
            indexBaseYear={
              transformation === "indexToYear" ? indexBaseYear : undefined
            }
            indexDate={
              transformation === "indexToYear"
                ? effectiveIndexBaseDate
                : undefined
            }
            leftChartType={leftChartType}
            rightChartType={rightChartType}
          />
        </div>

        <Separator />

        {/* Multi-series data table */}
        <AnalyzeDataTable
          rows={tableData}
          decimals={decimals}
          unitShortLabel={unitShortLabel}
          seriesNames={compareSeriesNames}
          activeTransformation={transformation}
          rightTransformation={rightTransformation}
          seriesAxisMap={seriesAxisMap}
        />
      </div>
  );
}
