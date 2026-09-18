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

import { DeleteSourceDialog } from "./delete-source-dialog";
import { SourceFormSheet } from "./source-form-sheet";

interface Source {
  id: number;
  universe: string;
  description: string | null;
  link: string | null;
}

interface SourcesListTableProps {
  data: Source[];
  universe?: Universe;
}

export function SourcesListTable({ data, universe }: SourcesListTableProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedSource(null);
    setFormOpen(true);
  };

  const handleEdit = (source: Source) => {
    setFormMode("edit");
    setSelectedSource(source);
    setFormOpen(true);
  };

  const handleDuplicate = (source: Source) => {
    setFormMode("create");
    setSelectedSource(source);
    setFormOpen(true);
  };

  const handleDelete = (source: Source) => {
    setSourceToDelete({
      id: source.id,
      name: source.description,
    });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} source{data.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Source
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((source) => (
                <TableRow key={source.id} className="odd:bg-muted">
                  <TableCell>{source.id}</TableCell>
                  <TableCell>{source.description || "-"}</TableCell>
                  <TableCell>
                    {source.link ? (
                      <a
                        href={source.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {source.link}
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{source.universe}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(source)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Duplicate"
                        onClick={() => handleDuplicate(source)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(source)}
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

      <SourceFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        source={selectedSource}
        defaultUniverse={universe}
      />

      <DeleteSourceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        sourceId={sourceToDelete?.id ?? null}
        sourceName={sourceToDelete?.name ?? null}
      />
    </>
  );
}
