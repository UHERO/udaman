"use client";

import { useState } from "react";
import Link from "next/link";
import { SeasonalAdjustment, Universe } from "@catalog/types/shared";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DeleteMeasurementDialog } from "./delete-measurement-dialog";
import { MeasurementFormSheet } from "./measurement-form-sheet";

interface MeasurementRow {
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
}

interface OptionItem {
  id: number;
  label: string;
}

interface MeasurementsListTableProps {
  data: MeasurementRow[];
  universe?: Universe;
  units: OptionItem[];
  sources: OptionItem[];
  sourceDetails: OptionItem[];
}

export function MeasurementsListTable({
  data,
  universe,
  units,
  sources,
  sourceDetails,
}: MeasurementsListTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedMeasurement, setSelectedMeasurement] =
    useState<MeasurementRow | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mToDelete, setMToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedMeasurement(null);
    setFormOpen(true);
  };

  const handleEdit = (m: MeasurementRow) => {
    setFormMode("edit");
    setSelectedMeasurement(m);
    setFormOpen(true);
  };

  const handleDuplicate = (m: MeasurementRow) => {
    setFormMode("create");
    setSelectedMeasurement(m);
    setFormOpen(true);
  };

  const handleDelete = (m: MeasurementRow) => {
    setMToDelete({
      id: m.id,
      name: m.prefix,
    });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} measurement{data.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Measurement
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prefix</TableHead>
              <TableHead>Data Portal Name</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Percent</TableHead>
              <TableHead>Real</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((m) => (
                <TableRow key={m.id} className="odd:bg-muted">
                  <TableCell className="font-medium">
                    <Link
                      href={`/udaman/${m.universe}/catalog/measurements/${m.id}`}
                      className="text-primary hover:underline"
                    >
                      {m.prefix}
                    </Link>
                  </TableCell>
                  <TableCell>{m.dataPortalName || "-"}</TableCell>
                  <TableCell>{m.unitShortLabel || "-"}</TableCell>
                  <TableCell>{m.percent ? "Yes" : "-"}</TableCell>
                  <TableCell>{m.real ? "Yes" : "-"}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {m.notes || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(m)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Duplicate"
                        onClick={() => handleDuplicate(m)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <MeasurementFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        measurement={selectedMeasurement}
        defaultUniverse={universe}
        units={units}
        sources={sources}
        sourceDetails={sourceDetails}
      />

      <DeleteMeasurementDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        measurementId={mToDelete?.id ?? null}
        measurementName={mToDelete?.name ?? null}
      />
    </>
  );
}
