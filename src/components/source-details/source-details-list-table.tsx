"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { Universe } from "@catalog/types/shared";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SourceDetailFormSheet } from "./source-detail-form-sheet";
import { DeleteSourceDetailDialog } from "./delete-source-detail-dialog";

interface SourceDetail {
  id: number;
  universe: string;
  description: string | null;
}

interface SourceDetailsListTableProps {
  data: SourceDetail[];
  universe?: Universe;
}

export function SourceDetailsListTable({
  data,
  universe,
}: SourceDetailsListTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedSourceDetail, setSelectedSourceDetail] =
    useState<SourceDetail | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sdToDelete, setSdToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedSourceDetail(null);
    setFormOpen(true);
  };

  const handleEdit = (sd: SourceDetail) => {
    setFormMode("edit");
    setSelectedSourceDetail(sd);
    setFormOpen(true);
  };

  const handleDuplicate = (sd: SourceDetail) => {
    setFormMode("create");
    setSelectedSourceDetail(sd);
    setFormOpen(true);
  };

  const handleDelete = (sd: SourceDetail) => {
    setSdToDelete({
      id: sd.id,
      name: sd.description,
    });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} source detail{data.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Source Detail
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((sd) => (
                <TableRow key={sd.id} className="odd:bg-muted">
                  <TableCell>{sd.id}</TableCell>
                  <TableCell>{sd.description || "-"}</TableCell>
                  <TableCell>{sd.universe}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(sd)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Duplicate"
                        onClick={() => handleDuplicate(sd)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(sd)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <SourceDetailFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        sourceDetail={selectedSourceDetail}
        defaultUniverse={universe}
      />

      <DeleteSourceDetailDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        sourceDetailId={sdToDelete?.id ?? null}
        sourceDetailName={sdToDelete?.name ?? null}
      />
    </>
  );
}
