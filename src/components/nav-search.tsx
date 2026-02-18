"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Info, ListFilter, Plus, X } from "lucide-react";

import { Button } from "./ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./ui/hover-card";
import { Input } from "./ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

// ── Filter definitions ──────────────────────────────────────────────

type FilterDef = {
  label: string;
  prefix: string;
  inputType: "text" | "geo" | "frequency" | "flag";
};

const FILTER_DEFS: FilterDef[] = [
  { label: "Prefix (^)", prefix: "^", inputType: "text" },
  { label: "Match (~)", prefix: "~", inputType: "text" },
  { label: "Geography (@)", prefix: "@", inputType: "geo" },
  { label: "Frequency (.)", prefix: ".", inputType: "frequency" },
  { label: "Source link (:)", prefix: ":", inputType: "text" },
  { label: "Load stmt (#)", prefix: "#", inputType: "text" },
  { label: "Load error (!)", prefix: "!", inputType: "text" },
  { label: "Flag (&)", prefix: "&", inputType: "flag" },
];

const FREQUENCY_OPTIONS = [
  { value: "A", label: "Annual" },
  { value: "S", label: "Semi-annual" },
  { value: "Q", label: "Quarterly" },
  { value: "M", label: "Monthly" },
  { value: "W", label: "Weekly" },
  { value: "D", label: "Daily" },
];

const FLAG_OPTIONS = [
  { value: "pub", label: "Public" },
  { value: "pct", label: "Percent" },
  { value: "sa", label: "Seasonally adjusted" },
  { value: "ns", label: "Not seasonally adjusted" },
  { value: "nodata", label: "No data" },
  { value: "noclock", label: "No clock" },
  { value: "noclip", label: "Not on clipboard" },
];

type FilterRow = {
  key: number;
  filterType: string;
  value: string;
};

let nextKey = 0;

// ── Component ───────────────────────────────────────────────────────

export function NavSearchInput({
  geoHandles = [],
}: {
  geoHandles?: string[];
}) {
  const router = useRouter();
  const { universe } = useParams<{ universe: string }>();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    doSearch(term);
  }

  function doSearch(q: string) {
    const trimmed = q.trim();
    if (trimmed) {
      router.push(
        `/udaman/${universe}/series?q=${encodeURIComponent(trimmed)}`,
      );
    } else {
      router.push(`/udaman/${universe}/series`);
    }
  }

  // ── Query builder helpers ───────────────────────────────────────

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey++, filterType: "", value: "" },
    ]);
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: number, field: "filterType" | "value", val: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        // Reset value when changing filter type
        if (field === "filterType") return { ...r, filterType: val, value: "" };
        return { ...r, [field]: val };
      }),
    );
  }

  function getFilterDef(filterType: string): FilterDef | undefined {
    return FILTER_DEFS.find((f) => f.prefix === filterType);
  }

  function buildQuery(): string {
    return rows
      .filter((r) => r.filterType && r.value)
      .map((r) => `${r.filterType}${r.value}`)
      .join(" ");
  }

  function handleBuilderSearch() {
    const q = buildQuery();
    if (q) {
      setTerm(q);
      doSearch(q);
      setBuilderOpen(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg items-center justify-center self-end rounded-sm border"
    >
      {/* Info hover card */}
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="rounded-r-none"
          >
            <Info className="h-4 w-4" />
          </Button>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-80 text-xs">
          <SearchSyntaxHelp />
        </HoverCardContent>
      </HoverCard>

      <Input
        className="border-none shadow-none"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search series..."
      />

      {/* Query builder popover */}
      <Popover open={builderOpen} onOpenChange={setBuilderOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="rounded-l-none"
          >
            <ListFilter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="space-y-3">
            <p className="text-sm font-medium">Build a search query</p>

            {rows.map((row) => {
              const def = getFilterDef(row.filterType);
              return (
                <div key={row.key} className="flex items-center gap-1.5">
                  {/* Filter type select */}
                  <Select
                    value={row.filterType}
                    onValueChange={(v) => updateRow(row.key, "filterType", v)}
                  >
                    <SelectTrigger className="w-28 shrink-0 text-xs">
                      <SelectValue placeholder="Filter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_DEFS.map((f) => (
                        <SelectItem key={f.prefix} value={f.prefix}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value input — type depends on filter */}
                  {(!def || def.inputType === "text") && (
                    <Input
                      className="h-8 text-xs"
                      placeholder="value"
                      value={row.value}
                      onChange={(e) =>
                        updateRow(row.key, "value", e.target.value)
                      }
                    />
                  )}

                  {def?.inputType === "geo" && (
                    <Select
                      value={row.value}
                      onValueChange={(v) => updateRow(row.key, "value", v)}
                    >
                      <SelectTrigger className="flex-1 text-xs">
                        <SelectValue placeholder="Select geo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {geoHandles.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {def?.inputType === "frequency" && (
                    <Select
                      value={row.value}
                      onValueChange={(v) => updateRow(row.key, "value", v)}
                    >
                      <SelectTrigger className="flex-1 text-xs">
                        <SelectValue placeholder="Frequency..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {def?.inputType === "flag" && (
                    <Select
                      value={row.value}
                      onValueChange={(v) => updateRow(row.key, "value", v)}
                    >
                      <SelectTrigger className="flex-1 text-xs">
                        <SelectValue placeholder="Flag..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FLAG_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeRow(row.key)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addRow}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add filter
            </Button>

            {rows.length > 0 && (
              <>
                <div className="bg-muted rounded-md px-2 py-1.5">
                  <code className="text-muted-foreground text-xs">
                    {buildQuery() || "(empty)"}
                  </code>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={!buildQuery()}
                  onClick={handleBuilderSearch}
                >
                  Search
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </form>
  );
}

// ── Syntax reference ────────────────────────────────────────────────

function SearchSyntaxHelp() {
  return (
    <div className="space-y-2">
      <p className="font-semibold">Search operators</p>
      <table className="w-full">
        <tbody className="[&_td]:py-0.5 [&_td:first-child]:pr-2 [&_td:first-child]:font-mono [&_td:first-child]:text-[11px] [&_td:last-child]:text-muted-foreground">
          <tr><td>^</td><td>Match start of mnemonic</td></tr>
          <tr><td>~</td><td>Match anywhere in mnemonic</td></tr>
          <tr><td>-</td><td>Omit matching from results</td></tr>
          <tr><td>@</td><td>Match geography</td></tr>
          <tr><td>.</td><td>Match frequency (A S Q M W D)</td></tr>
          <tr><td>#</td><td>Match load statement</td></tr>
          <tr><td>!</td><td>Match load error</td></tr>
          <tr><td>:</td><td>Match source link URL</td></tr>
          <tr><td>;</td><td>Match resource IDs</td></tr>
          <tr><td>=</td><td>Find by exact name</td></tr>
          <tr><td>/</td><td>Change universe</td></tr>
        </tbody>
      </table>
      <p className="font-semibold">Flags</p>
      <table className="w-full">
        <tbody className="[&_td]:py-0.5 [&_td:first-child]:pr-2 [&_td:first-child]:font-mono [&_td:first-child]:text-[11px] [&_td:last-child]:text-muted-foreground">
          <tr><td>&amp;pub</td><td>Public-facing only</td></tr>
          <tr><td>&amp;pct</td><td>Percent field set</td></tr>
          <tr><td>&amp;sa</td><td>Seasonally adjusted</td></tr>
          <tr><td>&amp;ns</td><td>Not seasonally adjusted</td></tr>
          <tr><td>&amp;nodata</td><td>Series with no data</td></tr>
          <tr><td>&amp;noclock</td><td>Clockless loader</td></tr>
          <tr><td>&amp;noclip</td><td>Exclude clipboard</td></tr>
        </tbody>
      </table>
      <p className="font-semibold">Examples</p>
      <table className="w-full">
        <tbody className="[&_td]:py-0.5 [&_td:first-child]:pr-2 [&_td:first-child]:font-mono [&_td:first-child]:text-[11px] [&_td:last-child]:text-muted-foreground">
          <tr><td>^vap$</td><td>Prefix &quot;vap&quot; exactly</td></tr>
          <tr><td>^yl,yc</td><td>Comma-separated alternatives</td></tr>
          <tr><td>~ns$</td><td>Match NS in name</td></tr>
          <tr><td>@cnty</td><td>County geographies</td></tr>
          <tr><td>145746</td><td>Find by series ID</td></tr>
        </tbody>
      </table>
    </div>
  );
}
