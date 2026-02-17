"use client";

import { useState } from "react";
import Link from "next/link";
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

import { DataListFormSheet } from "./data-list-form-sheet";
import { DeleteDataListDialog } from "./delete-data-list-dialog";

interface DataListRow {
  id: number;
  universe: string;
  name: string | null;
  measurementCount: number;
}

interface DataListsListTableProps {
  data: DataListRow[];
  universe?: Universe;
}

export function DataListsListTable({
  data,
  universe,
}: DataListsListTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedDataList, setSelectedDataList] = useState<DataListRow | null>(
    null,
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dlToDelete, setDlToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedDataList(null);
    setFormOpen(true);
  };

  const handleEdit = (dl: DataListRow) => {
    setFormMode("edit");
    setSelectedDataList(dl);
    setFormOpen(true);
  };

  const handleDuplicate = (dl: DataListRow) => {
    setFormMode("create");
    setSelectedDataList(dl);
    setFormOpen(true);
  };

  const handleDelete = (dl: DataListRow) => {
    setDlToDelete({
      id: dl.id,
      name: dl.name,
    });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} data list{data.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Data List
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Count</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((dl) => (
                <TableRow key={dl.id} className="odd:bg-muted">
                  <TableCell className="font-medium">
                    <Link
                      href={`/udaman/${dl.universe}/data-list/${dl.id}`}
                      className="text-primary hover:underline"
                    >
                      {dl.name || "-"}
                    </Link>
                  </TableCell>
                  <TableCell>{dl.measurementCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(dl)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Duplicate"
                        onClick={() => handleDuplicate(dl)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(dl)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataListFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        dataList={selectedDataList}
        defaultUniverse={universe}
      />

      <DeleteDataListDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        dataListId={dlToDelete?.id ?? null}
        dataListName={dlToDelete?.name ?? null}
      />
    </>
  );
}
