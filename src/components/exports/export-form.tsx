"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExportSeriesRow } from "@catalog/collections/export-collection";
import type { SerializedExport } from "@catalog/models/export";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  addSeriesToExportAction,
  createExportAction,
  getExportSeriesNamesAction,
  moveExportSeriesAction,
  removeSeriesFromExportAction,
  replaceAllExportSeriesAction,
  updateExportAction,
} from "@/actions/exports";
import { searchSeriesAction } from "@/actions/series-actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface ExportFormProps {
  export?: SerializedExport;
  series?: ExportSeriesRow[];
  universe: string;
}

export function ExportForm({ export: exp, series, universe }: ExportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!exp;

  // ── Create mode state ──────────────────────────────────────────────
  const [createName, setCreateName] = useState("");

  // ── Edit mode state ────────────────────────────────────────────────
  const [editName, setEditName] = useState(exp?.name ?? "");

  // Search series state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: number; name: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit as text dialog
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textValue, setTextValue] = useState("");

  // IDs already in the export
  const existingIds = new Set((series ?? []).map((s) => s.seriesId));

  // ── Search with debounce ───────────────────────────────────────────

  const doSearch = useCallback(
    async (term: string) => {
      if (term.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await searchSeriesAction(term, universe);
        setSearchResults(
          results
            .filter((r) => !existingIds.has(r.id))
            .map((r) => ({ id: r.id, name: r.name })),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [universe, existingIds.size],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchTerm), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, doSearch]);

  // ── Action helpers ─────────────────────────────────────────────────

  function runAction(
    action: () => Promise<{ success: boolean; message: string }>,
  ) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  // ── Create mode ────────────────────────────────────────────────────

  function handleCreate() {
    if (!createName.trim()) return;
    startTransition(async () => {
      try {
        const result = await createExportAction(createName.trim());
        if (result.success && result.id) {
          toast.success(result.message);
          router.push(`/udaman/${universe}/exports/${result.id}`);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create export");
      }
    });
  }

  // ── Edit mode handlers ─────────────────────────────────────────────

  function handleSaveName() {
    if (!exp) return;
    runAction(() => updateExportAction(exp.id, { name: editName }));
  }

  function handleMove(seriesId: number, direction: "up" | "down") {
    if (!exp) return;
    runAction(() => moveExportSeriesAction(exp.id, seriesId, direction));
  }

  function handleRemove(seriesId: number) {
    if (!exp) return;
    runAction(() => removeSeriesFromExportAction(exp.id, seriesId));
  }

  function handleAddSeries(seriesId: number) {
    if (!exp) return;
    setSearchOpen(false);
    setSearchTerm("");
    setSearchResults([]);
    runAction(() => addSeriesToExportAction(exp.id, seriesId));
  }

  async function handleOpenTextDialog() {
    if (!exp) return;
    try {
      const names = await getExportSeriesNamesAction(exp.id);
      setTextValue(names.join("\n"));
      setTextDialogOpen(true);
    } catch {
      toast.error("Failed to load series names");
    }
  }

  function handleSaveText() {
    if (!exp) return;
    const names = textValue
      .split(/\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const result = await replaceAllExportSeriesAction(exp.id, names);
        if (result.success) {
          toast.success(result.message);
          setTextDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  const base = `/udaman/${universe}/exports`;

  // ── Create mode render ─────────────────────────────────────────────

  if (!isEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={base}>
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Exports
            </Link>
          </Button>
        </div>

        <div className="max-w-md space-y-4">
          <h2 className="text-lg font-semibold">New Export</h2>
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="Export name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
          <Button
            onClick={handleCreate}
            disabled={isPending || !createName.trim()}
          >
            {isPending ? "Creating..." : "Create Export"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Edit mode render ───────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`${base}/${exp.id}`}>Show</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={base}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Exports
          </Link>
        </Button>
      </div>

      {/* Name editing */}
      <div className="max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <FieldSet className="m-0 gap-1 p-0">
          <FieldGroup className="gap-2">
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </FieldSet>
        <Button
          onClick={handleSaveName}
          disabled={isPending || editName === (exp.name ?? "")}
        >
          {isPending ? "Saving..." : "Save Name"}
        </Button>
      </div>

      {/* Series management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Series</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTextDialog}
            disabled={isPending}
          >
            <FileText className="mr-1.5 size-4" />
            Edit as Text
          </Button>
        </div>

        {(series ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No series in this export.
          </p>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px] text-center">Order</TableHead>
                  <TableHead className="w-[60px] text-center">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(series ?? []).map((s, idx) => (
                  <TableRow key={s.seriesId}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/udaman/${universe}/series/${s.seriesId}`}
                        className="text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={isPending || idx === 0}
                          onClick={() => handleMove(s.seriesId, "up")}
                          title="Move up"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={
                            isPending || idx === (series ?? []).length - 1
                          }
                          onClick={() => handleMove(s.seriesId, "down")}
                          title="Move down"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-7"
                        disabled={isPending}
                        onClick={() => handleRemove(s.seriesId)}
                        title="Remove series"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add series search */}
        <div className="flex items-end gap-2">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={searchOpen}
                className="w-[400px] justify-between"
              >
                <Search className="mr-2 size-4 shrink-0 opacity-50" />
                Search series to add...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Type series name..."
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                />
                <CommandList>
                  {searching ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <CommandEmpty>
                      {searchTerm.length < 2
                        ? "Type at least 2 characters..."
                        : "No series found."}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {searchResults.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={r.name}
                          onSelect={() => handleAddSeries(r.id)}
                        >
                          <Plus className="mr-2 size-4" />
                          {r.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Edit as Text Dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Series as Text</DialogTitle>
            <DialogDescription>
              One series name per line. Adding, removing, or reordering lines
              will update the export. Unknown names will be reported.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            placeholder="Enter series names, one per line..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveText} disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
