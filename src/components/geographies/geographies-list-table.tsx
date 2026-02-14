"use client";

import { useState } from "react";
import { Geography, Universe } from "@catalog/types/shared";
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

import { DeleteGeographyDialog } from "./delete-geography-dialog";
import { GeographyFormSheet } from "./geography-form-sheet";

interface GeographiesListTableProps {
  data: Geography[];
  universe?: Universe;
}

export function GeographiesListTable({
  data,
  universe,
}: GeographiesListTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedGeography, setSelectedGeography] = useState<Geography | null>(
    null,
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [geoToDelete, setGeoToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedGeography(null);
    setFormOpen(true);
  };

  const handleEdit = (geo: Geography) => {
    setFormMode("edit");
    setSelectedGeography(geo);
    setFormOpen(true);
  };

  const handleDuplicate = (geo: Geography) => {
    setFormMode("create");
    setSelectedGeography(geo);
    setFormOpen(true);
  };

  const handleDelete = (geo: Geography) => {
    setGeoToDelete({
      id: geo.id,
      name: geo.displayName || geo.handle,
    });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} geograph{data.length !== 1 ? "ies" : "y"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Geography
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Short Name</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>FIPS</TableHead>
              <TableHead>Geo Type</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((geo) => (
                <TableRow key={geo.id} className="odd:bg-muted">
                  <TableCell>{geo.id}</TableCell>
                  <TableCell>{geo.handle || "-"}</TableCell>
                  <TableCell>{geo.displayName || "-"}</TableCell>
                  <TableCell>{geo.displayNameShort || "-"}</TableCell>
                  <TableCell>{geo.universe}</TableCell>
                  <TableCell>{geo.fips || "-"}</TableCell>
                  <TableCell>{geo.geotype || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(geo)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Duplicate"
                        onClick={() => handleDuplicate(geo)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(geo)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <GeographyFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        geography={selectedGeography}
        defaultUniverse={universe}
      />

      <DeleteGeographyDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        geographyId={geoToDelete?.id ?? null}
        geographyName={geoToDelete?.name ?? null}
      />
    </>
  );
}
