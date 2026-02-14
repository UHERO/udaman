"use client";

import { useState } from "react";
import { Universe } from "@catalog/types/shared";
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

import { DeleteUnitDialog } from "./delete-unit-dialog";
import { UnitFormSheet } from "./unit-form-sheet";

interface Unit {
  id: number;
  universe: string;
  shortLabel: string | null;
  longLabel: string | null;
}

interface UnitsListTableProps {
  data: Unit[];
  universe?: Universe;
}

export function UnitsListTable({ data, universe }: UnitsListTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedUnit(null);
    setFormOpen(true);
  };

  const handleEdit = (unit: Unit) => {
    setFormMode("edit");
    setSelectedUnit(unit);
    setFormOpen(true);
  };

  const handleDuplicate = (unit: Unit) => {
    setFormMode("create");
    setSelectedUnit(unit);
    setFormOpen(true);
  };

  const handleDelete = (unit: Unit) => {
    setUnitToDelete({
      id: unit.id,
      name: unit.shortLabel || unit.longLabel,
    });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} unit{data.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Unit
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Short Label</TableHead>
              <TableHead>Long Label</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((unit) => (
                <TableRow key={unit.id} className="odd:bg-muted">
                  <TableCell>{unit.id}</TableCell>
                  <TableCell>{unit.shortLabel || "-"}</TableCell>
                  <TableCell>{unit.longLabel || "-"}</TableCell>
                  <TableCell>{unit.universe}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(unit)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Duplicate"
                        onClick={() => handleDuplicate(unit)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(unit)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UnitFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        unit={selectedUnit}
        defaultUniverse={universe}
      />

      <DeleteUnitDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        unitId={unitToDelete?.id ?? null}
        unitName={unitToDelete?.name ?? null}
      />
    </>
  );
}
