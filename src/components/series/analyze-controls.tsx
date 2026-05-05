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
  applyTransformation,
  applyTransformationMulti,
  ChangeChart,
  computeOverlays,
  computeSecondAxis,
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
  "vis",
  "axes",
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
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "border-input bg-background hover:bg-accent inline-flex h-5 items-center gap-0.5 rounded border px-1 font-mono text-[11px] transition-colors",
            className,
          )}
        >
          {fmt(value)}
          <ChevronsUpDown className="h-2.5 w-2.5 opacity-50" />
        </button>
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
  label,
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
  label: string;
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
      {/* Header: label + chart type toggle */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {label}
        </span>
        {showChartType && (
          <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
        )}
      </div>

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
                        <span className="text-muted-foreground text-[10px]">k</span>
                        <InlineSelect
                          value={String(rollingWindow)}
                          options={windowPresets.map((p) => String(p.k))}
                          onChange={(v) => onRollingWindowChange(parseInt(v, 10))}
                          formatOption={(v) => {
                            const preset = windowPresets.find((p) => String(p.k) === v);
                            return preset ? `${v} (${preset.label})` : `k=${v}`;
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-[10px]">σ</span>
                      <InlineSelect
                        value={String(stdDevMultiplier)}
                        options={["1", "2"]}
                        onChange={(v) => onStdDevMultiplierChange(parseInt(v, 10))}
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
  data: [string, number][];
  yoy: [string, number][];
  ytd: [string, number][];
  levelChange: [string, number][];
  pop?: [string, number][];
  decimals: number;
  unitLabel?: string | null;
  unitShortLabel?: string | null;
  currentFreqCode?: string | null;
  /** Multi-series compare mode */
  compareSeries?: Array<{
    name: string;
    data: [string, number][];
    unitShortLabel?: string | null;
  }>;
  /** Series name → ID map for linking to detail pages (compare mode) */
  seriesLinks?: Record<string, number>;
  /** Universe slug for building URLs (compare mode) */
  universe?: string;
  /** Timeline events for chart overlays */
  timelineEvents?: TimelineEventForChart[];
}

export function AnalyzeControls({
  data,
  yoy,
  ytd,
  levelChange,
  pop: popData,
  decimals,
  unitLabel,
  unitShortLabel,
  currentFreqCode,
  compareSeries: compareSeriesData,
  seriesLinks,
  universe,
  timelineEvents = [],
}: AnalyzeControlsProps) {
  const isCompareMode = !!(compareSeriesData && compareSeriesData.length >= 1);
  const router = useRouter();

  const searchParams = useSearchParams();

  // 3-state visibility: absent = colored (default), "gray" = muted, "hidden" = not rendered
  const [seriesVisibility, setSeriesVisibility] = useState<
    Map<number, "gray" | "hidden">
  >(() => {
    const v = searchParams.get("vis");
    if (!v) return new Map();
    const map = new Map<number, "gray" | "hidden">();
    for (const entry of v.split(",")) {
      const [idx, state] = entry.split(":");
      if (state === "gray" || state === "hidden") map.set(Number(idx), state);
    }
    return map;
  });

  const cycleVisibility = useCallback((index: number) => {
    setSeriesVisibility((prev) => {
      const next = new Map(prev);
      const current = prev.get(index);
      if (!current)
        next.set(index, "gray"); // colored → gray
      else if (current === "gray")
        next.set(index, "hidden"); // gray → hidden
      else next.delete(index); // hidden → colored
      return next;
    });
  }, []);

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
  // Derive whether right axis is active from its state
  const secondAxis = rightOverlays.length > 0 || rightTransformation !== null;
  const secondAxisTransformation = rightTransformation;
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

  // Left overlays (active when right axis doesn't have a transform that conflicts)
  const effectiveOverlays = overlays;

  // ── Compare mode: merge all series into unified chart rows ─────────
  const compareChartData = useMemo(() => {
    if (!isCompareMode) return [];
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
  }, [isCompareMode, compareSeriesData]);

  const compareSeriesNames = useMemo(
    () => (isCompareMode ? compareSeriesData.map((s) => s.name) : []),
    [isCompareMode, compareSeriesData],
  );

  /** Group visible (non-hidden) series indices by unit label for the compare stats bar */
  const compareUnits = useMemo(() => {
    if (!isCompareMode) return [];
    const map = new Map<string, number[]>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      const label = compareSeriesData[i].unitShortLabel ?? "—";
      const indices = map.get(label);
      if (indices) indices.push(i);
      else map.set(label, [i]);
    }
    return [...map.entries()]; // [label, seriesIndices[]]
  }, [isCompareMode, compareSeriesData, seriesVisibility]);

  /** User overrides for axis assignment (index → "left" | "right").
   *  Absent entries use the auto-default from unit groups. */
  const [axisOverrides, setAxisOverrides] = useState<
    Map<number, "left" | "right">
  >(() => {
    const v = searchParams.get("axes");
    if (!v) return new Map();
    const map = new Map<number, "left" | "right">();
    for (const entry of v.split(",")) {
      const [idx, side] = entry.split(":");
      if (side === "left" || side === "right") map.set(Number(idx), side);
    }
    return map;
  });

  /** Auto-default axis assignment based on unit groups */
  const autoAxisMap = useMemo(() => {
    const map = new Map<number, "left" | "right">();
    if (!isCompareMode) return map;
    if (compareUnits.length === 2) {
      for (const idx of compareUnits[0][1]) map.set(idx, "left");
      for (const idx of compareUnits[1][1]) map.set(idx, "right");
    } else {
      for (const [, indices] of compareUnits) {
        for (const idx of indices) map.set(idx, "left");
      }
    }
    return map;
  }, [isCompareMode, compareUnits]);

  /** Merged axis map: user overrides take precedence over auto-defaults */
  const seriesAxisMap = useMemo(() => {
    const map = new Map(autoAxisMap);
    for (const [idx, axis] of axisOverrides) {
      if (map.has(idx)) map.set(idx, axis);
    }
    return map;
  }, [autoAxisMap, axisOverrides]);

  const toggleSeriesAxis = useCallback(
    (index: number) => {
      setAxisOverrides((prev) => {
        const next = new Map(prev);
        const current = seriesAxisMap.get(index) ?? "left";
        next.set(index, current === "left" ? "right" : "left");
        return next;
      });
    },
    [seriesAxisMap],
  );

  const hasRightAxis = useMemo(
    () => [...seriesAxisMap.values()].some((v) => v === "right"),
    [seriesAxisMap],
  );

  /** Collect distinct unit labels for each axis side */
  const leftAxisLabel = useMemo(() => {
    if (!hasRightAxis || !isCompareMode) return undefined;
    const labels = new Set<string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "left")
        labels.add(compareSeriesData[i].unitShortLabel ?? "—");
    }
    return [...labels].join(", ") || undefined;
  }, [
    hasRightAxis,
    isCompareMode,
    compareSeriesData,
    seriesAxisMap,
    seriesVisibility,
  ]);

  const rightAxisLabel = useMemo(() => {
    if (!hasRightAxis || !isCompareMode) return undefined;
    const labels = new Set<string>();
    for (let i = 0; i < compareSeriesData.length; i++) {
      if (seriesVisibility.get(i) === "hidden") continue;
      if (seriesAxisMap.get(i) === "right")
        labels.add(compareSeriesData[i].unitShortLabel ?? "—");
    }
    return [...labels].join(", ") || undefined;
  }, [
    hasRightAxis,
    isCompareMode,
    compareSeriesData,
    seriesAxisMap,
    seriesVisibility,
  ]);

  /** Map series index → unit short label for tooltip display */
  const seriesUnitLabels = useMemo(() => {
    const map = new Map<number, string>();
    if (!isCompareMode) return map;
    for (let i = 0; i < compareSeriesData.length; i++) {
      map.set(i, compareSeriesData[i].unitShortLabel ?? "");
    }
    return map;
  }, [isCompareMode, compareSeriesData]);

  // ── Standard single-series chart data ──────────────────────────────
  const chartData = useMemo(() => {
    if (isCompareMode) return compareChartData;
    const map = new Map<string, ChartRow>();
    for (const [date, value] of data) {
      map.set(date, {
        date,
        level: value,
        levelChange: null,
        yoy: null,
        ytd: null,
        pop: null,
        cagr: null,
      });
    }
    for (const [date, value] of levelChange) {
      const existing = map.get(date);
      if (existing) existing.levelChange = value;
    }
    for (const [date, value] of yoy) {
      const existing = map.get(date);
      if (existing) existing.yoy = value;
    }
    for (const [date, value] of ytd) {
      const existing = map.get(date);
      if (existing) existing.ytd = value;
    }
    if (popData) {
      for (const [date, value] of popData) {
        const existing = map.get(date);
        if (existing) existing.pop = value;
      }
    }
    const sorted = [...map.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    // Compute running CAGR: ((current/first)^(ppy/i) - 1) * 100
    const ppy = PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12;
    let firstLevel: number | null = null;
    let periodIndex = 0;
    for (const row of sorted) {
      if (row.level == null) continue;
      if (firstLevel == null) {
        firstLevel = row.level;
        row.cagr = null; // no CAGR for first observation
      } else if (firstLevel > 0 && row.level > 0 && periodIndex > 0) {
        row.cagr =
          (Math.pow(row.level / firstLevel, ppy / periodIndex) - 1) * 100;
      }
      periodIndex++;
    }
    return sorted;
  }, [
    isCompareMode,
    compareChartData,
    data,
    yoy,
    ytd,
    levelChange,
    popData,
    currentFreqCode,
  ]);

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
      // Custom range — clamp indices to valid bounds
      setBrushRange((prev) => ({
        startIndex: Math.min(prev.startIndex, newEndIdx),
        endIndex: Math.min(prev.endIndex, newEndIdx),
      }));
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

  // Serialize map states for URL
  const visParam = useMemo(() => {
    if (seriesVisibility.size === 0) return undefined;
    return [...seriesVisibility.entries()]
      .map(([i, s]) => `${i}:${s}`)
      .join(",");
  }, [seriesVisibility]);

  const axesParam = useMemo(() => {
    if (axisOverrides.size === 0) return undefined;
    return [...axisOverrides.entries()]
      .map(([i, s]) => `${i}:${s}`)
      .join(",");
  }, [axisOverrides]);

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
      vis: visParam,
      axes: axesParam,
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
    visParam,
    axesParam,
  ]);

  // ── Available dates from brush-selected range ─────────────────────
  const availableDates = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    return sliced
      .filter((r) => {
        if (r.level != null) return true;
        // In compare mode, check series columns
        if (isCompareMode) {
          for (let s = 0; s < compareSeriesNames.length; s++) {
            const v = r[`series_${s}` as keyof typeof r];
            if (v != null) return true;
          }
        }
        return false;
      })
      .map((r) => r.date);
  }, [chartData, brushRange, isCompareMode, compareSeriesNames.length]);

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

  // ── Compare mode: full data with transforms (for chart + brush) ────
  const compareFullData = useMemo(() => {
    if (!isCompareMode) return [];
    return applyTransformationMulti(
      chartData,
      transformation,
      compareSeriesNames.length,
      indexBaseYear,
      rollingWindow,
      effectiveIndexBaseDate,
      currentFreqCode,
    );
  }, [
    isCompareMode,
    chartData,
    transformation,
    compareSeriesNames.length,
    indexBaseYear,
    rollingWindow,
    effectiveIndexBaseDate,
    currentFreqCode,
  ]);

  // ── Compare mode: sliced data with transforms (for table) ──────────
  const compareVisibleData = useMemo(() => {
    if (!isCompareMode) return [];
    return compareFullData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
  }, [isCompareMode, compareFullData, brushRange]);

  // Visible data for the chart (brush-filtered, with transforms applied)
  const visibleData = useMemo(() => {
    if (isCompareMode) return compareVisibleData;
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    let result = sliced;
    // Compute second axis transform first (reads original level)
    if (secondAxis && secondAxisTransformation) {
      result = computeSecondAxis(
        result,
        secondAxisTransformation,
        indexBaseYear,
        rollingWindow,
        effectiveIndexBaseDate,
        currentFreqCode,
      );
    }
    // Apply main transformation (replaces level)
    result = applyTransformation(
      result,
      transformation,
      indexBaseYear,
      rollingWindow,
      effectiveIndexBaseDate,
      currentFreqCode,
    );
    return result;
  }, [
    isCompareMode,
    compareVisibleData,
    chartData,
    brushRange,
    transformation,
    secondAxis,
    secondAxisTransformation,
    indexBaseYear,
    effectiveIndexBaseDate,
    rollingWindow,
    currentFreqCode,
  ]);

  // ── Compare mode: table data preserving original levels ─────────────
  const compareTableData = useMemo(() => {
    if (!isCompareMode) return [];
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    if (!transformation) return sliced;
    const transformed = applyTransformationMulti(
      sliced,
      transformation,
      compareSeriesNames.length,
      indexBaseYear,
      rollingWindow,
      effectiveIndexBaseDate,
      currentFreqCode,
    );
    return sliced.map((row, i) => {
      const result = { ...row };
      for (let s = 0; s < compareSeriesNames.length; s++) {
        const sKey = `series_${s}` as const;
        (result as unknown as Record<string, unknown>)[`transformed_${s}`] =
          transformed[i][sKey];
      }
      return result;
    });
  }, [
    isCompareMode,
    chartData,
    brushRange,
    transformation,
    compareSeriesNames.length,
    indexBaseYear,
    rollingWindow,
    effectiveIndexBaseDate,
    currentFreqCode,
  ]);

  // Table data — filtered to brush range, with overlays; transforms stored separately
  const tableData = useMemo(() => {
    if (isCompareMode) return compareTableData;
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    let rows = computeOverlays(sliced, effectiveOverlays, rollingWindow);
    if (secondAxis && secondAxisTransformation) {
      rows = computeSecondAxis(
        rows,
        secondAxisTransformation,
        indexBaseYear,
        rollingWindow,
        effectiveIndexBaseDate,
        currentFreqCode,
      );
    }
    if (transformation) {
      const transformed = applyTransformation(
        rows,
        transformation,
        indexBaseYear,
        rollingWindow,
        effectiveIndexBaseDate,
        currentFreqCode,
      );
      rows = rows.map((row, i) => ({
        ...row,
        mainTransformed: transformed[i].level,
      }));
    }
    return rows;
  }, [
    isCompareMode,
    compareTableData,
    chartData,
    brushRange,
    effectiveOverlays,
    rollingWindow,
    transformation,
    secondAxis,
    secondAxisTransformation,
    indexBaseYear,
    effectiveIndexBaseDate,
    currentFreqCode,
  ]);

  // Summary stats for the brush-selected range (first series in compare mode)
  const rangeStats = useMemo(() => {
    const sliced = chartData.slice(
      brushRange.startIndex,
      brushRange.endIndex + 1,
    );
    let levels: number[];
    if (isCompareMode) {
      levels = sliced
        .map((r) => r.series_0)
        .filter((v): v is number => v != null && !isNaN(v));
    } else {
      levels = sliced.map((r) => r.level).filter((v): v is number => v != null);
    }
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
  }, [chartData, brushRange, isCompareMode, currentFreqCode]);

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

  // ── Compare mode render ────────────────────────────────────────────
  if (isCompareMode) {
    return (
      <div className="flex flex-col gap-3">
        {/* Stats & range bar */}
        <div className="flex items-start justify-between gap-6 py-1">
          <div className="grid grid-cols-5 gap-x-5 gap-y-1">
            <StatCell
              label={`Mean (${compareSeriesNames[0]})`}
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
              <span className="text-muted-foreground text-md font-mono">
                {formatFreqDate(rangeStats.startDate, currentFreqCode)}
                {" — "}
                {formatFreqDate(rangeStats.endDate, currentFreqCode)}
              </span>
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

        {/* Transform */}
        <ControlPanel>
          <AxisColumn
            label="Transform"
            overlays={[]}
            onOverlaysChange={() => {}}
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
            showOverlays={false}
            showChartType={false}
          />
        </ControlPanel>

        {/* Two-column axis legend: Left Axis | Right Axis */}
        {(() => {
          const leftIndices = compareSeriesNames
            .map((_, i) => i)
            .filter((i) => seriesAxisMap.get(i) !== "right");
          const rightIndices = compareSeriesNames
            .map((_, i) => i)
            .filter((i) => seriesAxisMap.get(i) === "right");

          // Detect mixed units per axis (ignoring hidden series)
          const unitsOnAxis = (indices: number[]) => {
            const units = new Set<string>();
            for (const i of indices) {
              if (seriesVisibility.get(i) === "hidden") continue;
              units.add(compareSeriesData[i].unitShortLabel ?? "—");
            }
            return units;
          };
          const leftMixed = unitsOnAxis(leftIndices).size > 1;
          const rightMixed = unitsOnAxis(rightIndices).size > 1;

          const renderSeriesItem = (i: number, axisMixed: boolean) => {
            const name = compareSeriesNames[i];
            const vis = seriesVisibility.get(i);
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const warnHighlight = axisMixed && vis !== "hidden";
            const visTitles = {
              undefined: `Gray out ${name}`,
              gray: `Hide ${name}`,
              hidden: `Show ${name}`,
            } as const;
            return (
              <div
                key={name}
                className={`flex items-center gap-1 rounded px-1 font-mono text-xs ${warnHighlight ? "bg-amber-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => cycleVisibility(i)}
                  className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{
                    opacity: vis === "hidden" ? 0.4 : vis === "gray" ? 0.6 : 1,
                  }}
                  title={visTitles[vis ?? "undefined"]}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        vis === "hidden"
                          ? "transparent"
                          : vis === "gray"
                            ? "#94a3b8"
                            : color,
                      border:
                        vis === "hidden"
                          ? `1.5px solid ${color}`
                          : "1.5px solid transparent",
                    }}
                  />
                  <span className="truncate">{name}</span>
                </button>
                {compareSeriesNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleSeriesAxis(i)}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    title={`Move to ${seriesAxisMap.get(i) === "right" ? "left" : "right"} axis`}
                  >
                    <ArrowRightLeft className="h-3 w-3" />
                  </button>
                )}
                {universe && compareSeriesNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = compareSeriesNames.filter(
                        (n) => n !== name,
                      );
                      const url = new URL(window.location.href);
                      url.searchParams.set("names", remaining.join(","));
                      router.push(url.pathname + url.search);
                    }}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          };

          return (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Left Axis{leftAxisLabel ? ` (${leftAxisLabel})` : ""}
                </span>
                {leftIndices.length > 0 ? (
                  leftIndices.map((i) => renderSeriesItem(i, leftMixed))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    No series
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Right Axis{rightAxisLabel ? ` (${rightAxisLabel})` : ""}
                </span>
                {rightIndices.length > 0 ? (
                  rightIndices.map((i) => renderSeriesItem(i, rightMixed))
                ) : (
                  <span className="text-muted-foreground text-xs italic">
                    No series
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Multi-series level chart with brush */}
        <div className="w-full py-2">
          <LevelChart
            data={compareFullData}
            decimals={decimals}
            freqCode={currentFreqCode}
            seriesNames={compareSeriesNames}
            seriesVisibility={seriesVisibility}
            seriesAxisMap={seriesAxisMap}
            leftAxisLabel={leftAxisLabel}
            rightAxisLabel={rightAxisLabel}
            seriesUnitLabels={seriesUnitLabels}
            selectedEvents={selectedEvents}
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
        />
      </div>
    );
  }

  // ── Standard single-series render ──────────────────────────────────

  return (
    <div className="space-y-3">
      {/* FRED-style control bar */}
      <div className="flex items-start justify-between gap-6 py-1">
        {/* Col 1: Summary stats for selected range */}
        <div className="grid grid-cols-5 gap-x-5 gap-y-1">
          <StatCell
            label="Min"
            value={rangeStats ? fmt(rangeStats.min) : "—"}
          />
          <StatCell
            label="Max"
            value={rangeStats ? fmt(rangeStats.max) : "—"}
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
            label="Total"
            value={rangeStats ? fmt(rangeStats.total) : "—"}
          />
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
            label="CAGR"
            value={
              rangeStats?.cagr != null ? `${rangeStats.cagr.toFixed(2)}%` : "—"
            }
          />
          <StatCell
            label="Obs"
            value={rangeStats ? String(rangeStats.n) : "—"}
          />
        </div>
        <Separator orientation="vertical" className="h-auto self-stretch" />

        {/* Col 2: Range presets + date display */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {RANGE_PRESETS.filter(
                (p) =>
                  p.minPPY <= (PERIODS_PER_YEAR[currentFreqCode ?? "M"] ?? 12),
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
            <span className="text-muted-foreground text-md font-mono">
              {formatFreqDate(rangeStats.startDate, currentFreqCode)}
              {" — "}
              {formatFreqDate(rangeStats.endDate, currentFreqCode)}
            </span>
          )}
        </div>
        {/* Col 3: Timeline */}
        {timelineEvents.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-auto self-stretch" />
            <div className="flex flex-col gap-1">
              <TimelineControl
                timelineEvents={timelineEvents}
                selectedEventTypes={selectedEventTypes}
                onSelectedEventTypesChange={setSelectedEventTypes}
              />
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-auto self-stretch" />

        {/* Col 4: Units */}
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Units</span>
          <span className="text-sm font-medium">{unitLabel || "—"}</span>
        </div>
      </div>

      <Separator />

      {/* Two-column axis controls: [Left Axis] [Right Axis] */}
      {chartStats && (
        <ControlPanel>
          <div className="grid grid-cols-2 gap-4">
            <AxisColumn
              label="Left Axis"
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
            />
            <AxisColumn
              label="Right Axis"
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
            />
          </div>
        </ControlPanel>
      )}

      {/* Level line chart */}
      <div className="w-full py-2">
        <LevelChart
          data={visibleData}
          decimals={decimals}
          stats={chartStats ?? undefined}
          overlays={effectiveOverlays}
          unitShortLabel={unitShortLabel}
          secondAxis={secondAxis}
          transformationLabel={
            secondAxisTransformation
              ? TRANSFORMATION_LABELS[secondAxisTransformation]
              : undefined
          }
          freqCode={currentFreqCode}
          rollingWindow={rollingWindow}
          indexBaseYear={
            transformation === "indexToYear" ||
            secondAxisTransformation === "indexToYear"
              ? indexBaseYear
              : undefined
          }
          indexDate={
            transformation === "indexToYear" ||
            secondAxisTransformation === "indexToYear"
              ? effectiveIndexBaseDate
              : undefined
          }
          selectedEvents={selectedEvents}
          leftChartType={leftChartType}
          rightChartType={rightChartType}
          stdDevMultiplier={stdDevMultiplier}
        />
      </div>

      <Separator />

      {/* Bar chart with mode toggle */}
      <div className="w-full py-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-muted-foreground w-16 shrink-0 text-xs font-medium">
            Changes
          </span>
          <ToggleGroup
            type="single"
            value={barMode}
            onValueChange={(v) => {
              if (v) setBarMode(v as BarMode);
            }}
            variant="default"
            size="sm"
          >
            <ToggleGroupItem value="yoy" className="h-7 px-2.5 text-xs">
              YOY %
            </ToggleGroupItem>
            <ToggleGroupItem value="ytd" className="h-7 px-2.5 text-xs">
              YTD %
            </ToggleGroupItem>
            <ToggleGroupItem value="pop" className="h-7 px-2.5 text-xs">
              {currentFreqCode === "M"
                ? "MoM %"
                : currentFreqCode === "Q"
                  ? "QoQ %"
                  : "PoP %"}
            </ToggleGroupItem>
            <ToggleGroupItem value="levelChange" className="h-7 px-2.5 text-xs">
              LVL Chg
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ChangeChart
          data={chartData}
          decimals={decimals}
          barMode={barMode}
          unitShortLabel={unitShortLabel}
          brushStartIndex={brushRange.startIndex}
          brushEndIndex={brushRange.endIndex}
          onBrushChange={handleBrushChange}
          freqCode={currentFreqCode}
        />
      </div>

      <Separator />

      {/* Data table — shares overlay/transform state with charts */}
      <AnalyzeDataTable
        rows={tableData}
        decimals={decimals}
        unitShortLabel={unitShortLabel}
        activeOverlays={effectiveOverlays}
        activeTransformation={transformation}
        secondAxis={secondAxis}
        secondAxisTransformation={secondAxisTransformation}
      />
    </div>
  );
}
