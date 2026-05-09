"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ApiKeyFormSheet } from "./api-key-form-sheet";
import { DeleteApiKeyDialog } from "./delete-api-key-dialog";

interface ApiKeyData {
  id: number;
  universe: string;
  name: string | null;
  hostname: string | null;
  apiKey: string | null;
  githubNickname: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ApiKeysPanelProps {
  data: ApiKeyData[];
}

function maskApiKey(key: string | null): string {
  if (!key) return "-";
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export function ApiKeysPanel({ data }: ApiKeysPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedKey, setSelectedKey] = useState<ApiKeyData | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{
    id: number;
    name: string | null;
  } | null>(null);

  const handleCreate = () => {
    setFormMode("create");
    setSelectedKey(null);
    setFormOpen(true);
  };

  const handleEdit = (apiKey: ApiKeyData) => {
    setFormMode("edit");
    setSelectedKey(apiKey);
    setFormOpen(true);
  };

  const handleDelete = (apiKey: ApiKeyData) => {
    setKeyToDelete({ id: apiKey.id, name: apiKey.name });
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {data.length} API key{data.length !== 1 && "s"}
        </p>
        <Button className="cursor-pointer" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <div className="overflow-hidden rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>GitHub</TableHead>
              <TableHead>Universe</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? (
              data.map((apiKey) => (
                <TableRow key={apiKey.id} className="odd:bg-muted">
                  <TableCell>{apiKey.id}</TableCell>
                  <TableCell>{apiKey.name || "-"}</TableCell>
                  <TableCell>{apiKey.hostname || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {maskApiKey(apiKey.apiKey)}
                  </TableCell>
                  <TableCell>{apiKey.githubNickname || "-"}</TableCell>
                  <TableCell>{apiKey.universe}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Edit"
                        onClick={() => handleEdit(apiKey)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer"
                        title="Delete"
                        onClick={() => handleDelete(apiKey)}
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
                  No API keys found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ApiKeyFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        apiKey={selectedKey}
      />

      <DeleteApiKeyDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        apiKeyId={keyToDelete?.id ?? null}
        apiKeyName={keyToDelete?.name ?? null}
      />
    </>
  );
}
