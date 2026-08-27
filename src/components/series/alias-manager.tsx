"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SeriesAlias, Universe } from "@catalog/types/shared";
import { UNIVERSES } from "@catalog/types/shared";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createAlias, deleteSeries } from "@/actions/series-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AliasManagerProps {
  seriesId: number;
  currentUniverse: string;
  isPrimary: boolean;
  aliases: SeriesAlias[];
}

export function AliasManager({
  seriesId,
  currentUniverse,
  isPrimary,
  aliases,
}: AliasManagerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedUniverse, setSelectedUniverse] = useState<string>("");
  const [isCreating, startCreate] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Universes that already have this series (current + aliases)
  const takenUniverses = new Set([
    currentUniverse,
    ...aliases.map((a) => a.universe),
  ]);

  const availableUniverses = UNIVERSES.filter((u) => !takenUniverses.has(u));

  const handleCreate = () => {
    if (!selectedUniverse) return;
    startCreate(async () => {
      const result = await createAlias(seriesId, selectedUniverse as Universe);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(result.message);
        setSelectedUniverse("");
        router.refresh();
      }
    });
  };

  const handleDelete = async (alias: SeriesAlias) => {
    if (!alias.id) return;
    setDeletingId(alias.id);
    try {
      await deleteSeries(alias.id, alias.universe);
      toast.success(`Alias in ${alias.universe} deleted`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete alias");
    } finally {
      setDeletingId(null);
    }
  };

  const aliasCount = aliases.length;

  return (
    <span className="flex w-full items-center justify-between">
      <span>{aliasCount > 0 ? aliasCount : "-"}</span>
      {isPrimary && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-5 w-5"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Manage Aliases</SheetTitle>
              <SheetDescription>
                Aliases share the same data points across universes.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 p-4">
              {/* Current series */}
              <div>
                <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  Current Universes
                </h4>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="font-bold">{currentUniverse}</span>
                    <span className="text-muted-foreground text-xs">
                      primary
                    </span>
                  </div>
                  {aliases.map((alias) => (
                    <div
                      key={alias.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span>{alias.universe}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={deletingId === alias.id}
                        onClick={() => handleDelete(alias)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add alias */}
              {availableUniverses.length > 0 && (
                <div>
                  <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Add Alias
                  </h4>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedUniverse}
                      onValueChange={setSelectedUniverse}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select universe" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUniverses.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedUniverse || isCreating}
                      onClick={handleCreate}
                    >
                      Create
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
      {!isPrimary && aliasCount > 0 && (
        <span className="text-muted-foreground text-xs">
          (managed by primary)
        </span>
      )}
    </span>
  );
}
