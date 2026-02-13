"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearLoader,
  deleteLoader,
  disableLoader,
  enableLoader,
  reloadLoader,
} from "@/actions/data-loaders";
import {
  deleteSeriesDataPoints,
  resolveSeriesIds,
} from "@/actions/series-actions";
import type { SerializedLoader } from "@catalog/models/loader";
import Series from "@catalog/models/series";
import type { Universe } from "@catalog/types/shared";
import { formatRuntime, uheroDate } from "@catalog/utils/time";
import { format } from "date-fns";
import { Clock10, ClockPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
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
import { LoaderCreateDialog } from "@/components/loaders/loader-create-dialog";
import { LoaderEditSheet } from "@/components/loaders/loader-edit-sheet";

import { getColor } from "../helpers";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

/** Split text into segments, extracting HTML anchor tags as typed parts. */
function splitTextSegments(text: string): Array<{ type: "text"; value: string } | { type: "link"; href: string; label: string }> {
  const parts: Array<{ type: "text"; value: string } | { type: "link"; href: string; label: string }> = [];
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
    resolveSeriesIds(names).then(setIdMap);
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
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  const handleClearAll = () =>
    startTransition(async () => {
      try {
        await deleteSeriesDataPoints(seriesId, {
          universe,
          date: "",
          deleteBy: "none",
        });
        toast.success("Data cleared", {
          description: "All data points for this series have been deleted",
        });
        router.refresh();
      } catch (err) {
        toast.error("Clear failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleLoadAll = () =>
    startTransition(async () => {
      try {
        const enabledLoaders = loaders.filter((l) => !l.disabled);
        const errors: string[] = [];
        for (const loader of enabledLoaders) {
          const result = await reloadLoader(loader.id);
          if (result.data.status === "error") {
            errors.push(`#${loader.id}: ${result.data.message}`);
          }
        }
        if (errors.length > 0) {
          toast.error(`${errors.length} loader(s) failed`, {
            description: errors.join("; "),
          });
        } else {
          toast.success("All loaders completed", {
            description: `Ran ${enabledLoaders.length} loader(s)`,
          });
        }
        router.refresh();
      } catch (err) {
        toast.error("Load all failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  return (
    <div className="flex flex-col border-b">
      <div className="flex h-6 flex-row items-center justify-start border-b pb-2 font-semibold">
        <span className="mr-4">Loaders</span>
        <Button variant={"link"} onClick={() => setCreateOpen(true)}>
          new
        </Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant={"link"} disabled={isPending}>
              clear data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all data points?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all data points for this series across all
                loaders.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll}>
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button variant={"link"} onClick={handleLoadAll} disabled={isPending}>
          {isPending ? "loading..." : "load all"}
        </Button>
      </div>

      {loaders.map((l, i) =>
        l.disabled ? (
          <DisabledLoaderItem key={`data-loader-${i}`} loader={l} />
        ) : (
          <LoaderItem key={`data-loader-${i}`} universe={universe} loader={l} />
        )
      )}

      <LoaderCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        universe={universe as Universe}
        seriesId={seriesId}
      />
    </div>
  );
};

const LoaderItem = ({
  universe,
  loader,
}: {
  universe: string;
  loader: SerializedLoader;
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const lastRunDate =
    loader.lastRunAt !== null ? uheroDate(loader.lastRunAt) : "-";
  const lastRunTime =
    loader.lastRunAt !== null ? format(loader.lastRunAt, "HH:MM") : "-";
  const runtime = formatRuntime(loader.runtime);

  const handleLoad = () =>
    startTransition(async () => {
      try {
        const result = await reloadLoader(loader.id);
        const { status, message } = result.data;
        if (status === "error") {
          toast.error("Loader failed", { description: message });
        } else if (status === "skipped") {
          toast("Loader skipped", { description: message });
        } else {
          toast.success("Loader completed", { description: message });
        }
        router.refresh();
      } catch (err) {
        toast.error("Loader failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleClear = () =>
    startTransition(async () => {
      try {
        const result = await clearLoader(loader.id);
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error("Clear failed", {
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
            disabled={isPending}
          >
            {isPending ? "loading..." : "load"}
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="clear datapoints"
            variant="link"
            size="sm"
            className="h-6"
            onClick={handleClear}
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
        <span className="text-primary/70 font-normal">{`last run: ${lastRunDate} ${lastRunTime}`}</span>
        <span className="text-primary/70 font-normal">{`duration: ${runtime}`}</span>
        <span
          className={cn(
            "ml-auto",
            parseInt(loader.scale) === 1 && "text-primary/60"
          )}
        >{`scale: ${loader.scale}`}</span>
      </CardFooter>

      <LoaderEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        loader={loader}
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
