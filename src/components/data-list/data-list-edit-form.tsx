"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Universe } from "@catalog/types/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronUp,
  ClipboardCopy,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  addAllSeriesToClipboardAction,
  addMeasurementAction,
  createMeasurementForDataList,
  moveMeasurementAction,
  removeMeasurementAction,
  replaceAllMeasurementsAction,
  setMeasurementIndentAction,
  updateDataList,
} from "@/actions/data-lists";
import { MeasurementFormSheet } from "@/components/measurements/measurement-form-sheet";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
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

// ─── Types ──────────────────────────────────────────────────────────

interface DataListData {
  id: number;
  universe: string;
  name: string | null;
  startYear: number | null;
  endYear: number | null;
  ownedBy: number | null;
  ownerEmail: string | null;
}

interface MeasurementRow {
  measurementId: number;
  prefix: string;
  dataPortalName: string | null;
  listOrder: number;
  indent: string;
}

interface AllMeasurement {
  id: number;
  prefixAndName: string;
}

interface UserOption {
  id: number;
  email: string;
}

interface OptionItem {
  id: number;
  label: string;
}

interface DataListEditFormProps {
  dataList: DataListData;
  measurements: MeasurementRow[];
  allMeasurements: AllMeasurement[];
  users: UserOption[];
  universe: Universe;
  units: OptionItem[];
  sources: OptionItem[];
  sourceDetails: OptionItem[];
}

// ─── Indent helpers ─────────────────────────────────────────────────

const INDENT_PX: Record<string, number> = {
  indent0: 0,
  indent1: 16,
  indent2: 32,
  indent3: 48,
};

// ─── Metadata form schema ───────────────────────────────────────────

const metadataSchema = z.object({
  name: z.string(),
  startYear: z.string(),
  ownedBy: z.string(),
});

type MetadataValues = z.infer<typeof metadataSchema>;

// ─── Component ──────────────────────────────────────────────────────

export function DataListEditForm({
  dataList,
  measurements,
  allMeasurements,
  users,
  universe,
  units,
  sources,
  sourceDetails,
}: DataListEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comboOpen, setComboOpen] = useState(false);
  const [ownerComboOpen, setOwnerComboOpen] = useState(false);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<
    number | null
  >(null);

  // Feature 1: Create Measurement sheet state
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // Feature 2: Edit as Text dialog state
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [textValue, setTextValue] = useState("");

  // IDs already in the list — filter them out of the add dropdown
  const existingIds = new Set(measurements.map((m) => m.measurementId));
  const availableMeasurements = allMeasurements.filter(
    (m) => !existingIds.has(m.id),
  );

  // ── Action helpers ────────────────────────────────────────────────

  function runAction(action: () => Promise<{ message: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        toast.success(result.message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  function handleMove(measurementId: number, direction: "up" | "down") {
    runAction(() =>
      moveMeasurementAction(dataList.id, measurementId, direction),
    );
  }

  function handleIndent(measurementId: number, direction: "in" | "out") {
    runAction(() =>
      setMeasurementIndentAction(dataList.id, measurementId, direction),
    );
  }

  function handleRemove(measurementId: number) {
    runAction(() => removeMeasurementAction(dataList.id, measurementId));
  }

  function handleAdd() {
    if (!selectedMeasurementId) return;
    const id = selectedMeasurementId;
    setSelectedMeasurementId(null);
    setComboOpen(false);
    runAction(() => addMeasurementAction(dataList.id, id));
  }

  // Feature 1: Create measurement and add to data list
  async function handleCreateMeasurement(payload: Record<string, unknown>) {
    const result = await createMeasurementForDataList(
      dataList.id,
      payload as Parameters<typeof createMeasurementForDataList>[1],
    );
    toast.success(result.message);
    setCreateSheetOpen(false);
    router.refresh();
  }

  // Feature 2: Replace all measurements from text
  function handleOpenTextDialog() {
    setTextValue(measurements.map((m) => m.prefix).join("\n"));
    setTextDialogOpen(true);
  }

  function handleSaveText() {
    const prefixes = textValue
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const result = await replaceAllMeasurementsAction(
          dataList.id,
          prefixes,
          universe,
        );
        if (!result.success) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        setTextDialogOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  // Feature 3: Add all series to clipboard
  function handleAddAllToClipboard() {
    runAction(() => addAllSeriesToClipboardAction(dataList.id));
  }

  // ── Metadata form ────────────────────────────────────────────────

  const form = useForm<MetadataValues>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      name: dataList.name ?? "",
      startYear: dataList.startYear?.toString() ?? "",
      ownedBy: dataList.ownedBy?.toString() ?? "",
    },
  });

  async function onSubmitMetadata(values: MetadataValues) {
    try {
      const result = await updateDataList(dataList.id, {
        name: values.name || null,
        startYear: values.startYear ? parseInt(values.startYear) : null,
        ownedBy: values.ownedBy ? parseInt(values.ownedBy) : null,
      });
      toast.success(result.message);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to update data list",
      );
    }
  }

  // ── Selected measurement label for combobox ──────────────────────

  const selectedLabel = selectedMeasurementId
    ? availableMeasurements.find((m) => m.id === selectedMeasurementId)
        ?.prefixAndName
    : null;

  return (
    <div className="space-y-8">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/udaman/${universe}/catalog/data-lists/${dataList.id}`}>
            Show (Super Table)
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/udaman/${universe}/catalog/data-lists`}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Data Lists
          </Link>
        </Button>
      </div>

      {/* Section A: Measurement management table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Measurements</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenTextDialog}
              disabled={isPending}
            >
              <FileText className="mr-1.5 size-4" />
              Edit as Text
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAllToClipboard}
              disabled={isPending}
            >
              <ClipboardCopy className="mr-1.5 size-4" />
              Add All to Clipboard
            </Button>
          </div>
        </div>

        {measurements.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No measurements in this data list.
          </p>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Prefix</TableHead>
                  <TableHead>Data Portal Name</TableHead>
                  <TableHead className="w-[100px] text-center">Order</TableHead>
                  <TableHead className="w-[100px] text-center">
                    Indent
                  </TableHead>
                  <TableHead className="w-[60px] text-center">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurements.map((m, idx) => (
                  <TableRow key={m.measurementId}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/udaman/${universe}/catalog/measurements/${m.measurementId}`}
                        className="text-primary hover:underline"
                      >
                        {m.prefix}
                      </Link>
                    </TableCell>
                    <TableCell
                      style={{
                        paddingLeft: `${8 + (INDENT_PX[m.indent] ?? 0)}px`,
                      }}
                    >
                      {m.dataPortalName}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={isPending || idx === 0}
                          onClick={() => handleMove(m.measurementId, "up")}
                          title="Move up"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={
                            isPending || idx === measurements.length - 1
                          }
                          onClick={() => handleMove(m.measurementId, "down")}
                          title="Move down"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={isPending}
                          onClick={() => handleIndent(m.measurementId, "out")}
                          title="Indent out"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <span className="text-muted-foreground w-4 text-center text-xs">
                          {m.indent.replace("indent", "")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={isPending}
                          onClick={() => handleIndent(m.measurementId, "in")}
                          title="Indent in"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-7"
                        disabled={isPending}
                        onClick={() => handleRemove(m.measurementId)}
                        title="Remove measurement"
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

        {/* Section B: Add measurement combobox + Create New */}
        <div className="flex items-end gap-2">
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-[400px] justify-between"
              >
                {selectedLabel ?? "Select measurement..."}
                <ChevronsDownUp className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="Search measurements..." />
                <CommandList>
                  <CommandEmpty>No measurements found.</CommandEmpty>
                  <CommandGroup>
                    {availableMeasurements.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.prefixAndName}
                        onSelect={() => {
                          setSelectedMeasurementId(m.id);
                          setComboOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 size-4 ${
                            selectedMeasurementId === m.id
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {m.prefixAndName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleAdd}
            disabled={isPending || !selectedMeasurementId}
          >
            <Plus className="mr-1.5 size-4" />
            Add Measurement
          </Button>
          <Button
            variant="secondary"
            onClick={() => setCreateSheetOpen(true)}
            disabled={isPending}
          >
            <Plus className="mr-1.5 size-4" />
            Create New Measurement
          </Button>
        </div>
      </div>

      {/* Section C: Metadata form */}
      <div className="max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>

        <form
          onSubmit={form.handleSubmit(onSubmitMetadata)}
          className="space-y-4"
        >
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-2">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="Data list name"
                  {...form.register("name")}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.startYear}>
                <FieldLabel htmlFor="startYear">Start Year</FieldLabel>
                <Input
                  id="startYear"
                  type="number"
                  placeholder="e.g. 2000"
                  {...form.register("startYear")}
                />
                <FieldError errors={[form.formState.errors.startYear]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.ownedBy}>
                <FieldLabel>Owned By</FieldLabel>
                <Popover open={ownerComboOpen} onOpenChange={setOwnerComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={ownerComboOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.watch("ownedBy")
                        ? (users.find(
                            (u) => u.id.toString() === form.watch("ownedBy"),
                          )?.email ?? "Unknown user")
                        : "Select owner..."}
                      <ChevronsDownUp className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              form.setValue("ownedBy", "");
                              setOwnerComboOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 size-4 ${
                                !form.watch("ownedBy")
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <span className="text-muted-foreground">None</span>
                          </CommandItem>
                          {users.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={u.email}
                              onSelect={() => {
                                form.setValue("ownedBy", u.id.toString());
                                setOwnerComboOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 size-4 ${
                                  form.watch("ownedBy") === u.id.toString()
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              {u.email}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FieldError errors={[form.formState.errors.ownedBy]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Details"}
          </Button>
        </form>
      </div>

      {/* Feature 1: Create Measurement Sheet */}
      <MeasurementFormSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        mode="create"
        defaultUniverse={universe}
        units={units}
        sources={sources}
        sourceDetails={sourceDetails}
        onCreated={handleCreateMeasurement}
      />

      {/* Feature 2: Edit as Text Dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Measurements as Text</DialogTitle>
            <DialogDescription>
              One measurement prefix per line. Adding, removing, or reordering
              lines will update the data list. Unknown prefixes will be
              rejected.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            rows={20}
            className="font-mono text-sm"
            placeholder="Enter measurement prefixes, one per line..."
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
