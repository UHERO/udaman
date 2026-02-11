"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SerializedLoader } from "@catalog/models/loader";
import Series from "@catalog/models/series";
import { formatRuntime, uheroDate } from "@catalog/utils/time";
import { format } from "date-fns";
import { Clock10, ClockPlus } from "lucide-react";
import { toast } from "sonner";

import { reloadLoader, clearLoader, deleteLoader, disableLoader, enableLoader } from "@/actions/data-loaders";
import { resolveSeriesIds } from "@/actions/series-actions";
import { cn } from "@/lib/utils";
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
import { getColor } from "../helpers";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

/** Render text with series names as direct links to their series page. */
const LinkedText = ({ text, universe }: { text: string; universe: string }) => {
  const [idMap, setIdMap] = useState<Record<string, number>>({});
  const words = text.split(" ");

  useEffect(() => {
    const names = text.split(" ").filter((w) => Series.isValidName(w));
    if (names.length === 0) return;
    resolveSeriesIds(names).then(setIdMap);
  }, [text]);

  return (
    <>
      {words.map((word, i) => {
        const prefix = i > 0 ? " " : "";

        if (Series.isValidName(word)) {
          const id = idMap[word];
          if (id) {
            return (
              <span key={i}>
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
          return <span key={i}>{prefix}{word}</span>;
        }

        if (/^<(.+)>$/.test(word)) {
          // TODO: link to download when download routes are implemented
          return (
            <span key={i} className="italic" title={word.slice(1, -1)}>
              {prefix}{word}
            </span>
          );
        }

        return <span key={i}>{prefix}{word}</span>;
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
  const [isPending, startTransition] = useTransition();

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
          toast("All loaders completed", {
            description: `Ran ${enabledLoaders.length} loader(s)`,
          });
        }
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
        <Button variant={"link"}>
          <Link
            href={`/udaman/${universe}/data-loaders/new?seriesId=${seriesId}`}
          >
            new
          </Link>
        </Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button variant={"link"}>
          <Link href={`/udaman/${universe}/series/${seriesId}/delete`}>
            clear data
          </Link>
        </Button>
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
          toast("Loader completed", { description: message });
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
        await clearLoader(loader.id);
        toast("Data points cleared", {
          description: `Cleared data points for loader ${loader.id}`,
        });
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
        await deleteLoader(loader.id);
        toast("Loader deleted", {
          description: `Deleted loader ${loader.id}`,
        });
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
        await disableLoader(loader.id);
        toast("Loader disabled", {
          description: `Disabled loader ${loader.id}`,
        });
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
                  This will permanently delete this loader and all of its data points. This action cannot be undone.
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
            asChild
          >
            <Link href={`/udaman/${universe}/data-loaders/edit/${loader.id}`}>
              edit
            </Link>
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
    </Card>
  );
};

const DisabledLoaderItem = ({ loader }: { loader: SerializedLoader }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleEnable = () =>
    startTransition(async () => {
      try {
        await enableLoader(loader.id);
        toast("Loader enabled", {
          description: `Enabled loader ${loader.id}`,
        });
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
        <span className="text-muted-foreground text-sm">
          {loader.id}
        </span>
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
