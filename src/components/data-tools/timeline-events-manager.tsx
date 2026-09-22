"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  formatEventType,
  type SerializedTimelineEvent,
} from "@catalog/models/timeline-event";
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTimelineEventAction,
  deleteTimelineEventAction,
  updateTimelineEventAction,
} from "@/actions/timeline-events";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

type FormData = {
  name: string;
  eventType: string;
  description: string;
  startDate: string;
  endDate: string;
};

const emptyForm: FormData = {
  name: "",
  eventType: "recession",
  description: "",
  startDate: "",
  endDate: "",
};

/** Combobox that shows existing event types but allows typing a new one */
function EventTypeCombobox({
  value,
  onChange,
  existingTypes,
}: {
  value: string;
  onChange: (v: string) => void;
  existingTypes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return existingTypes;
    const lower = search.toLowerCase();
    return existingTypes.filter(
      (t) =>
        t.toLowerCase().includes(lower) ||
        formatEventType(t).toLowerCase().includes(lower),
    );
  }, [existingTypes, search]);

  // If user typed something that doesn't match any existing type, show it as a "create" option
  const normalizedSearch = search.trim().toLowerCase().replace(/\s+/g, "_");
  const showCreateOption =
    search.trim() && !existingTypes.some((t) => t === normalizedSearch);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value ? formatEventType(value) : "Select type..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        style={{ zIndex: 60 }}
      >
        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder="Search or type new..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-48 overflow-y-auto px-1 pb-1">
          {filtered.map((type) => (
            <button
              key={type}
              type="button"
              className={cn(
                "hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                value === type && "bg-accent",
              )}
              onClick={() => {
                onChange(type);
                setSearch("");
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5",
                  value === type ? "opacity-100" : "opacity-0",
                )}
              />
              {formatEventType(type)}
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {type}
              </span>
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
              onClick={() => {
                onChange(normalizedSearch);
                setSearch("");
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create &quot;{formatEventType(normalizedSearch)}&quot;
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {normalizedSearch}
              </span>
            </button>
          )}
          {filtered.length === 0 && !showCreateOption && (
            <p className="text-muted-foreground px-2 py-3 text-center text-sm">
              No types found.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  events: SerializedTimelineEvent[];
}

export function TimelineEventsManager({ events }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Derive existing types from events for the combobox
  const existingTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.eventType));
    return [...types].sort();
  }, [events]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(event: SerializedTimelineEvent) {
    setEditingId(event.id);
    setForm({
      name: event.name,
      eventType: event.eventType,
      description: event.description ?? "",
      startDate: event.startDate,
      endDate: event.endDate ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.startDate) {
      toast.error("Name and start date are required");
      return;
    }
    if (!form.eventType.trim()) {
      toast.error("Event type is required");
      return;
    }
    startTransition(async () => {
      const payload = {
        name: form.name.trim(),
        eventType: form.eventType.trim(),
        description: form.description.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate || null,
      };
      if (editingId) {
        const result = await updateTimelineEventAction(editingId, payload);
        toast.success(result.message);
      } else {
        const result = await createTimelineEventAction(payload);
        toast.success(result.message);
      }
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteTimelineEventAction(deleteId);
      toast.success(result.message);
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Timeline Events</h2>
          <p className="text-muted-foreground text-sm">
            Manage historical events displayed as chart overlays.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Event
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formatEventType(event.eventType)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {event.startDate}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {event.endDate ?? "—"}
                </TableCell>
                <TableCell
                  className="text-muted-foreground max-w-48 truncate text-sm"
                  title={event.description ?? undefined}
                >
                  {event.description ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(event)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700"
                      onClick={() => setDeleteId(event.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {events.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  No timeline events yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Great Recession (2007-09)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Event Type</Label>
              <EventTypeCombobox
                value={form.eventType}
                onChange={(v) => setForm({ ...form, eventType: v })}
                existingTypes={existingTypes}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timeline event? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
