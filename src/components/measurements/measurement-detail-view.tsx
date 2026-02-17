"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addSeriesAction,
  propagateFieldsAction,
  removeSeriesAction,
} from "@/actions/measurements";
import type { MeasurementSeriesRow } from "@catalog/collections/measurement-collection";
import type { SeasonalAdjustment, Universe } from "@catalog/types/shared";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { MeasurementFormSheet } from "./measurement-form-sheet";

// ─── Types ───────────────────────────────────────────────────────────

interface MeasurementData {
  id: number;
  universe: string;
  prefix: string;
  dataPortalName: string | null;
  unitId: number | null;
  sourceId: number | null;
  sourceDetailId: number | null;
  decimals: number;
  percent: boolean | null;
  real: boolean | null;
  restricted: boolean;
  seasonalAdjustment: SeasonalAdjustment | null;
  frequencyTransform: string | null;
  sourceLink: string | null;
  notes: string | null;
  unitShortLabel: string | null;
  sourceDescription: string | null;
  sourceDetailDescription: string | null;
}

interface OptionItem {
  id: number;
  label: string;
}

interface MeasurementDetailViewProps {
  measurement: MeasurementData;
  series: MeasurementSeriesRow[];
  universe: Universe;
  units: OptionItem[];
  sources: OptionItem[];
  sourceDetails: OptionItem[];
}

// ─── Field config ────────────────────────────────────────────────────

const PROPAGATABLE_FIELDS: {
  key: string;
  label: string;
  displayKey?: string;
}[] = [
  { key: "dataPortalName", label: "Data portal name" },
  { key: "unitId", label: "Units", displayKey: "unitShortLabel" },
  { key: "sourceId", label: "Source", displayKey: "sourceDescription" },
  { key: "sourceLink", label: "Source link" },
  {
    key: "sourceDetailId",
    label: "Source detail",
    displayKey: "sourceDetailDescription",
  },
  { key: "seasonalAdjustment", label: "Seasonal adjustment" },
  { key: "percent", label: "Percent" },
  { key: "real", label: "Real" },
  { key: "decimals", label: "Decimals" },
  { key: "frequencyTransform", label: "Frequency transform" },
  { key: "restricted", label: "Restricted" },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatFieldValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatSA(sa: string | null): string {
  if (!sa) return "-";
  if (sa === "seasonally_adjusted") return "SA";
  if (sa === "not_seasonally_adjusted") return "NS";
  if (sa === "not_applicable") return "N/A";
  return sa;
}

// ─── Component ───────────────────────────────────────────────────────

export function MeasurementDetailView({
  measurement,
  series,
  universe,
  units,
  sources,
  sourceDetails,
}: MeasurementDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [addSeriesName, setAddSeriesName] = useState("");

  const allFieldsSelected =
    selectedFields.size === PROPAGATABLE_FIELDS.length;
  const allSeriesSelected =
    selectedSeries.size === series.length && series.length > 0;

  // ── Toggle helpers ─────────────────────────────────────────────────

  function toggleField(key: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllFields() {
    if (allFieldsSelected) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(PROPAGATABLE_FIELDS.map((f) => f.key)));
    }
  }

  function toggleSeries(name: string) {
    setSelectedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAllSeries() {
    if (allSeriesSelected) {
      setSelectedSeries(new Set());
    } else {
      setSelectedSeries(new Set(series.map((s) => s.name)));
    }
  }

  // ── Actions ────────────────────────────────────────────────────────

  function handlePropagate() {
    if (selectedFields.size === 0 || selectedSeries.size === 0) {
      toast.error("Select at least one field and one series");
      return;
    }
    startTransition(async () => {
      try {
        const result = await propagateFieldsAction(
          measurement.id,
          Array.from(selectedFields),
          Array.from(selectedSeries)
        );
        toast.success(result.message);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to propagate fields"
        );
      }
    });
  }

  function handleAddSeries() {
    const name = addSeriesName.trim();
    if (!name) return;
    if (series.some((s) => s.name === name)) {
      toast.error(`${name} already in measurement`);
      return;
    }
    startTransition(async () => {
      try {
        const result = await addSeriesAction(measurement.id, name);
        toast.success(result.message);
        setAddSeriesName("");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Series not found"
        );
      }
    });
  }

  function handleRemoveSeries(seriesId: number, seriesName: string) {
    startTransition(async () => {
      try {
        const result = await removeSeriesAction(measurement.id, seriesId);
        toast.success(result.message);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : `Failed to remove ${seriesName}`
        );
      }
    });
  }

  const m = measurement as unknown as Record<string, unknown>;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">
          {measurement.prefix}
          {measurement.dataPortalName && (
            <span className="text-muted-foreground ml-2 text-lg font-normal">
              {measurement.dataPortalName}
            </span>
          )}
        </h1>
        <Button
          variant="outline"
          size="icon"
          className="size-8 cursor-pointer"
          title="Edit measurement"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      {/* Metadata fields checklist */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold">Fields to propagate</h2>
          <button
            type="button"
            className="text-primary text-xs hover:underline"
            onClick={toggleAllFields}
          >
            {allFieldsSelected ? "Deselect all" : "Select all"}
          </button>
          <Button
            className="ml-auto cursor-pointer"
            disabled={
              isPending ||
              selectedFields.size === 0 ||
              selectedSeries.size === 0
            }
            onClick={handlePropagate}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Propagating...
              </>
            ) : (
              `Propagate to ${selectedSeries.size} series`
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-x-6 gap-y-1.5">
          {PROPAGATABLE_FIELDS.map(({ key, label, displayKey }) => {
            const displayValue = displayKey ? m[displayKey] : m[key];
            const raw = m[key];
            const formatted =
              key === "seasonalAdjustment"
                ? formatSA(raw as string | null)
                : formatFieldValue(displayValue);
            return (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedFields.has(key)}
                  onCheckedChange={() => toggleField(key)}
                />
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-medium">{formatted}</span>
              </label>
            );
          })}
        </div>

        {measurement.notes && (
          <div className="text-sm">
            <span className="text-muted-foreground">Notes: </span>
            <span>{measurement.notes}</span>
          </div>
        )}
      </div>

      {/* Series table */}
      <div className="min-h-screen flex-1 rounded-xl md:min-h-min">
        <div className="mb-2 flex items-center gap-4">
          <h2 className="text-sm font-semibold">
            Series ({series.length})
          </h2>
          {series.length > 0 && (
            <button
              type="button"
              className="text-primary text-xs hover:underline"
              onClick={toggleAllSeries}
            >
              {allSeriesSelected ? "Deselect all" : "Select all"}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="Series name..."
              className="h-8 w-64"
              value={addSeriesName}
              onChange={(e) => setAddSeriesName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSeries();
                }
              }}
            />
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={isPending || !addSeriesName.trim()}
              onClick={handleAddSeries}
            >
              Add Series
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={allSeriesSelected}
                    onCheckedChange={toggleAllSeries}
                  />
                </TableHead>
                <TableHead>Series</TableHead>
                <TableHead>Data Portal Name</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Source Link</TableHead>
                <TableHead>Source Detail</TableHead>
                <TableHead>SA</TableHead>
                <TableHead>Pct</TableHead>
                <TableHead>Real</TableHead>
                <TableHead>Dec</TableHead>
                <TableHead>Res</TableHead>
                <TableHead>Freq Trn</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={14}
                    className="text-muted-foreground h-24 text-center"
                  >
                    No series associated with this measurement.
                  </TableCell>
                </TableRow>
              ) : (
                series.map((s) => (
                  <TableRow key={s.id} className="odd:bg-muted">
                    <TableCell>
                      <Checkbox
                        checked={selectedSeries.has(s.name)}
                        onCheckedChange={() => toggleSeries(s.name)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/udaman/${universe}/series/${s.id}`}
                        className="text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell
                      className="max-w-40 truncate"
                      title={s.dataPortalName ?? ""}
                    >
                      {s.dataPortalName ?? "-"}
                    </TableCell>
                    <TableCell>{s.unitShortLabel ?? "-"}</TableCell>
                    <TableCell
                      className="max-w-32 truncate"
                      title={s.sourceDescription ?? ""}
                    >
                      {s.sourceDescription ?? "-"}
                    </TableCell>
                    <TableCell
                      className="max-w-28 truncate"
                      title={s.sourceLink ?? ""}
                    >
                      {s.sourceLink ?? "-"}
                    </TableCell>
                    <TableCell
                      className="max-w-32 truncate"
                      title={s.sourceDetailDescription ?? ""}
                    >
                      {s.sourceDetailDescription ?? "-"}
                    </TableCell>
                    <TableCell>{formatSA(s.seasonalAdjustment)}</TableCell>
                    <TableCell>{s.percent ? "Y" : "-"}</TableCell>
                    <TableCell>{s.real ? "Y" : "-"}</TableCell>
                    <TableCell>{s.decimals}</TableCell>
                    <TableCell>{s.restricted ? "Y" : "-"}</TableCell>
                    <TableCell>{s.frequencyTransform ?? "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-7 cursor-pointer"
                        title="Remove series"
                        disabled={isPending}
                        onClick={() => handleRemoveSeries(s.id, s.name)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit measurement sheet */}
      <MeasurementFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        measurement={measurement}
        defaultUniverse={universe}
        units={units}
        sources={sources}
        sourceDetails={sourceDetails}
      />
    </div>
  );
}
