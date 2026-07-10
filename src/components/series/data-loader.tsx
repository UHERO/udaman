"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DeleteByMode } from "@catalog/collections/series-collection";
import type { SerializedLoader } from "@catalog/models/loader";
import Series from "@catalog/models/series";
import type { Universe } from "@catalog/types/shared";
import { formatHstTimestamp, formatRuntime } from "@catalog/utils/time";
import { Clock10, ClockPlus } from "lucide-react";
import { toast } from "sonner";

import {
  clearLoader,
  deleteLoader,
  disableLoader,
  enableLoader,
  getLoaderJobStatus,
  reloadLoader,
} from "@/actions/data-loaders";
import {
  deleteSeriesDataPoints,
  resolveSeriesIds,
  syncPublicDataPoints,
} from "@/actions/series-actions";
import { LoaderCreateDialog } from "@/components/loaders/loader-create-dialog";
import { LoaderEditSheet } from "@/components/loaders/loader-edit-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { getColor } from "../helpers";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

/** Split text into segments, extracting HTML anchor tags as typed parts. */
function splitTextSegments(
  text: string,
): Array<
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string }
> {
  const parts: Array<
    | { type: "text"; value: string }
    | { type: "link"; href: string; label: string }
  > = [];
  const anchorRegex = /<a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "link", href: match[1], label: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

/** Render text with series names as direct links and HTML anchors as clickable links. */
const LinkedText = ({ text, universe }: { text: string; universe: string }) => {
  const [idMap, setIdMap] = useState<Record<string, number>>({});

  useEffect(() => {
    // Strip HTML tags before extracting series names
    const plainText = text.replace(/<[^>]*>/g, " ");
    const names = plainText.split(" ").filter((w) => Series.isValidName(w));
    if (names.length === 0) return;
    resolveSeriesIds(names, universe).then(setIdMap);
  }, [text]);

  const segments = splitTextSegments(text);

  return (
    <>
      {segments.map((segment, segIdx) => {
        if (segment.type === "link") {
          return (
            <a
              key={`seg-${segIdx}`}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-70"
            >
              {segment.label}
            </a>
          );
        }

        const words = segment.value.split(" ");
        return words.map((word, i) => {
          const prefix = segIdx > 0 || i > 0 ? " " : "";

          if (Series.isValidName(word)) {
            const id = idMap[word];
            if (id) {
              return (
                <span key={`${segIdx}-${i}`}>
                  {prefix}
                  <Link
                    href={`/udaman/${universe}/series/${id}`}
                    className="underline hover:opacity-70"
                  >
                    {word}
                  </Link>
                </span>
              );
            }
            return (
              <span key={`${segIdx}-${i}`}>
                {prefix}
                {word}
              </span>
            );
          }

          const fileMatch = word.match(/^<(.+)>$/);
          if (fileMatch) {
            const filePath = fileMatch[1];
            return (
              <span key={`${segIdx}-${i}`}>
                {prefix}
                {"<"}
                <a
                  href={`/api/data-file/${filePath}`}
                  className="underline hover:opacity-70"
                  title={`Download ${filePath}`}
                >
                  {filePath}
                </a>
                {">"}
              </span>
            );
          }

          return (
            <span key={`${segIdx}-${i}`}>
              {prefix}
              {word}
            </span>
          );
        });
      })}
    </>
  );
};

const CLEAR_MODES: {
  value: DeleteByMode;
  label: string;
  description: string;
  needsDate: boolean;
}[] = [
  {
    value: "none",
    label: "All",
    description: "Clear all data points",
    needsDate: false,
  },
  {
    value: "observationDate",
    label: "After date",
    description: "Delete points on or after date",
    needsDate: true,
  },
  {
    value: "beforeObservationDate",
    label: "Before date",
    description: "Delete points on or before date",
    needsDate: true,
  },
  {
    value: "currentOnly",
    label: "Current only",
    description: "Delete only current points (preserves vintages)",
    needsDate: false,
  },
  {
    value: "vintageDate",
    label: "After vintage",
    description: "Delete points loaded after date",
    needsDate: true,
  },
];

function ClearDataDialog({
  open,
  onOpenChange,
  seriesId,
  universe,
  loaderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: number;
  universe: string;
  /** When set, scopes deletion to this loader's data points only */
  loaderId?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteBy, setDeleteBy] = useState<DeleteByMode>("none");
  const [date, setDate] = useState("");

  const needsDate =
    CLEAR_MODES.find((m) => m.value === deleteBy)?.needsDate ?? false;
  const scope = loaderId ? `loader #${loaderId}` : "this series";

  const handleClear = () =>
    startTransition(async () => {
      try {
        if (needsDate && !date) {
          toast.error("Please enter a date");
          return;
        }
        if (loaderId) {
          await clearLoader(loaderId, { deleteBy, date });
        } else {
          await deleteSeriesDataPoints(seriesId, { universe, date, deleteBy });
        }
        const modeLabel =
          CLEAR_MODES.find((m) => m.value === deleteBy)?.label ?? deleteBy;
        toast.success("Data cleared", {
          description: `Cleared data points (${modeLabel}${needsDate ? `: ${date}` : ""})`,
        });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error("Clear failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Clear Data Points</DialogTitle>
          <DialogDescription>
            Choose how to clear data points for {scope}.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={deleteBy}
          onValueChange={(v) => setDeleteBy(v as DeleteByMode)}
          className="gap-3"
        >
          {CLEAR_MODES.map((mode) => (
            <div key={mode.value} className="flex items-start gap-2">
              <RadioGroupItem
                value={mode.value}
                id={`clear-${loaderId ?? "s"}-${mode.value}`}
                className="mt-0.5"
              />
              <Label
                htmlFor={`clear-${loaderId ?? "s"}-${mode.value}`}
                className="cursor-pointer leading-tight font-normal"
              >
                <span className="font-semibold">{mode.label}</span>
                <span className="text-muted-foreground ml-1 text-xs">
                  {mode.description}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div
          className={cn(
            "transition-opacity",
            needsDate ? "opacity-100" : "pointer-events-none opacity-30",
          )}
        >
          <Label htmlFor={`clear-date-${loaderId ?? "s"}`} className="text-xs">
            Date <span className="text-muted-foreground">(YYYY-MM-DD)</span>
          </Label>
          <Input
            id={`clear-date-${loaderId ?? "s"}`}
            placeholder="YYYY-MM-DD"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!needsDate}
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={isPending}
          >
            {isPending ? "Clearing..." : "Clear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const LoaderSection = ({
  universe,
  seriesId,
  loaders,
}: {
  universe: string;
  seriesId: number;
  loaders: SerializedLoader[];
}) => {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<
    { loaderId: number; jobId: string }[]
  >([]);

  const isLoading = pendingJobs.length > 0;

  // Poll all pending jobs
  useEffect(() => {
    if (pendingJobs.length === 0) return;
    const interval = setInterval(async () => {
      const results = await Promise.all(
        pendingJobs.map(async ({ loaderId, jobId }) => {
          const status = await getLoaderJobStatus(jobId);
          return { loaderId, jobId, ...status };
        }),
      );
      const still = results.filter(
        (r) => r.state !== "completed" && r.state !== "failed",
      );
      const done = results.filter(
        (r) => r.state === "completed" || r.state === "failed",
      );
      if (done.length > 0) {
        setPendingJobs(still);
      }
      if (still.length === 0 && pendingJobs.length > 0) {
        const failed = results.filter((r) => r.state === "failed");
        const succeeded = results.filter((r) => r.state === "completed");
        if (failed.length > 0) {
          toast.error(`${failed.length} loader(s) failed`, {
            description: failed
              .map((f) => `#${f.loaderId}: ${f.failedReason ?? "unknown"}`)
              .join("; "),
          });
        }
        if (succeeded.length > 0) {
          toast.success(`${succeeded.length} loader(s) completed`);
        }
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingJobs, router]);

  const [isSyncing, startSyncTransition] = useTransition();

  const handleSyncPublic = () =>
    startSyncTransition(async () => {
      try {
        const result = await syncPublicDataPoints(seriesId, universe);
        toast.success(result.message);
      } catch (err) {
        toast.error("Sync failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleLoadAll = async () => {
    try {
      const enabledLoaders = loaders.filter((l) => !l.disabled);
      const jobs: { loaderId: number; jobId: string }[] = [];
      for (const loader of enabledLoaders) {
        const result = await reloadLoader(loader.id);
        jobs.push({ loaderId: loader.id, jobId: result.data.jobId });
      }
      setPendingJobs(jobs);
      toast.info("Reloads queued", {
        description: `Enqueued ${jobs.length} loader(s)`,
      });
    } catch (err) {
      toast.error("Load all failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex flex-col border-b">
      <div className="flex h-6 flex-row items-center justify-start border-b pb-2 font-semibold">
        <span className="mr-4">Loaders</span>
        <Button variant={"link"} onClick={() => setCreateOpen(true)}>
          new
        </Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button
          variant={"link"}
          onClick={() => setClearOpen(true)}
          disabled={isLoading}
        >
          clear data
        </Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button variant={"link"} onClick={handleLoadAll} disabled={isLoading}>
          {isLoading ? "loading..." : "load all"}
        </Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button
          variant={"link"}
          onClick={handleSyncPublic}
          disabled={isSyncing}
        >
          {isSyncing ? "syncing..." : "sync public"}
        </Button>
      </div>

      {[...loaders]
        .sort((a, b) => b.priority - a.priority)
        .map((l) =>
          l.disabled ? (
            <DisabledLoaderItem key={`data-loader-${l.id}`} loader={l} />
          ) : (
            <LoaderItem
              key={`data-loader-${l.id}`}
              universe={universe}
              seriesId={seriesId}
              loader={l}
            />
          ),
        )}

      <LoaderCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        universe={universe as Universe}
        seriesId={seriesId}
      />
      <ClearDataDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        seriesId={seriesId}
        universe={universe}
      />
    </div>
  );
};

const LoaderItem = ({
  universe,
  seriesId,
  loader,
}: {
  universe: string;
  seriesId: number;
  loader: SerializedLoader;
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const lastRunFormatted = formatHstTimestamp(loader.lastRunAt);
  const runtime = formatRuntime(loader.runtime);

  const isLoading = isPending || !!jobId;

  // Poll job status when a reload is queued
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const status = await getLoaderJobStatus(jobId);
      if (status.state === "completed") {
        toast.success("Loader completed", { description: status.result });
        setJobId(null);
        router.refresh();
      } else if (status.state === "failed") {
        toast.error("Loader failed", {
          description: status.failedReason ?? "Unknown error",
        });
        setJobId(null);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, router]);

  const handleLoad = () =>
    startTransition(async () => {
      try {
        const result = await reloadLoader(loader.id);
        setJobId(result.data.jobId);
        toast.info("Reload queued", { description: result.message });
      } catch (err) {
        toast.error("Loader failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleDelete = () =>
    startTransition(async () => {
      try {
        const result = await deleteLoader(loader.id);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error("Delete failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleDisable = () =>
    startTransition(async () => {
      try {
        const result = await disableLoader(loader.id);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error("Disable failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  return (
    <Card className={cn("p-2", getColor(loader.color))}>
      <CardContent className="flex h-6 items-center justify-between gap-x-2">
        <CardDescription title="Load Priority" className="mr-auto">
          {loader.priority}
        </CardDescription>

        <CardAction>
          <Button
            title="load data points"
            variant="link"
            size="sm"
            className="h-6"
            onClick={handleLoad}
            disabled={isLoading}
          >
            {isLoading ? "loading..." : "load"}
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="clear datapoints"
            variant="link"
            size="sm"
            className="h-6"
            onClick={() => setClearOpen(true)}
            disabled={isPending}
          >
            clear
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                title="delete data loader"
                variant="link"
                size="sm"
                className="h-6"
                disabled={isPending}
              >
                delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Loader {loader.id}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this loader and all of its data
                  points. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="disable data loader"
            variant="link"
            size="sm"
            className="h-6"
            onClick={handleDisable}
            disabled={isPending}
          >
            disable
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="edit data loader"
            variant="link"
            size="sm"
            className="h-6"
            onClick={() => setEditOpen(true)}
          >
            edit
          </Button>
        </CardAction>
      </CardContent>
      <CardHeader>
        <CardTitle className="flex items-center">
          <span className="text-primary/90 mr-2 text-lg font-semibold">
            {loader.id}
          </span>
          <Button
            variant={"ghost"}
            size={"icon"}
            title="Toggle nightly load"
            className="border-gray-500 hover:scale-105 hover:border hover:bg-white/40"
          >
            {loader.reloadNightly ? (
              <Clock10 className="stroke-primary" />
            ) : (
              <ClockPlus className="stroke-primary/50" />
            )}
          </Button>
        </CardTitle>
        {loader.lastError && (
          <p className="text-xs text-red-800" title={loader.lastError}>
            {loader.lastError}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <CardDescription>
          <p className="text-primary text-pretty wrap-break-word">
            {loader.description ? (
              <LinkedText text={loader.description} universe={universe} />
            ) : null}
          </p>
          <p className="text-primary text-pretty wrap-break-word">
            {loader.eval}
          </p>
        </CardDescription>
      </CardContent>
      <CardFooter className="flex flex-row justify-start gap-x-4 text-xs">
        <span className="text-primary/70 font-normal">{`last run: ${lastRunFormatted}`}</span>
        <span className="text-primary/70 font-normal">{`duration: ${runtime}`}</span>
        <span
          className={cn(
            "ml-auto",
            parseInt(loader.scale) === 1 && "text-primary/60",
          )}
        >{`scale: ${loader.scale}`}</span>
      </CardFooter>

      <LoaderEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        loader={loader}
      />
      <ClearDataDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        seriesId={seriesId}
        universe={universe}
        loaderId={loader.id}
      />
    </Card>
  );
};

const DisabledLoaderItem = ({ loader }: { loader: SerializedLoader }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleEnable = () =>
    startTransition(async () => {
      try {
        const result = await enableLoader(loader.id);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error("Enable failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  return (
    <Card className="bg-muted/40 p-2 opacity-60">
      <CardContent className="flex h-6 items-center gap-x-2">
        <span className="text-muted-foreground text-sm">{loader.id}</span>
        <span className="text-muted-foreground text-xs italic">disabled</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {loader.description ?? loader.eval}
        </span>
        <Button
          variant="link"
          size="sm"
          className="text-muted-foreground h-6"
          onClick={handleEnable}
          disabled={isPending}
        >
          {isPending ? "enabling..." : "enable"}
        </Button>
      </CardContent>
    </Card>
  );
};
