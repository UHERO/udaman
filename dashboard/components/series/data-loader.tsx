import Link from "next/link";
import { DataLoader } from "@shared/types/shared";
import { formatRuntime, uheroDate } from "@shared/utils/time";
import { format } from "date-fns";
import { Clock10, ClockPlus } from "lucide-react";

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

import { getColor } from "../helpers";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

export const LoaderSection = ({
  seriesId,
  loaders,
}: {
  seriesId: number;
  loaders: DataLoader[];
}) => {
  //   console.log("LoaderSection", loaders);
  return (
    <div className="flex flex-col border-b">
      <div className="flex h-6 flex-row items-center justify-start border-b pb-2 font-semibold">
        <span className="mr-4">Loaders</span>
        <Button variant={"link"}>new</Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button variant={"link"}>clear data</Button>
        <Separator orientation="vertical" className="bg-primary/60 h-4" />
        <Button variant={"link"}>load all</Button>
      </div>

      {loaders.map((l, i) => (
        <LoaderItem key={`data-loader-${i}`} loader={l} />
      ))}
    </div>
  );
};

const LoaderItem = ({ loader }: { loader: DataLoader }) => {
  const lastRunDate =
    loader.last_run_at !== null ? uheroDate(loader.last_run_at) : "-";
  const lastRunTime =
    loader.last_run_at !== null ? format(loader.last_run_at, "HH:MM") : "-";
  const runtime = formatRuntime(loader.runtime);
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
          >
            load
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="clear datapoints"
            variant="link"
            size="sm"
            className="h-6"
          >
            clear
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="delete data loader"
            variant="link"
            size="sm"
            className="h-6"
          >
            delete
          </Button>
        </CardAction>
        <Separator orientation="vertical" className="bg-primary/60 w-4" />
        <CardAction>
          <Button
            title="disable data loader"
            variant="link"
            size="sm"
            className="h-6"
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
            <Link href={`/data-loaders/edit/${loader.id}`}>edit</Link>
          </Button>
        </CardAction>
      </CardContent>
      <CardHeader>
        <CardTitle className="flex items-center">
          <span className="text-primary/90 mr-2 text-lg font-semibold">
            {loader.id}
          </span>
          <Button variant={"ghost"} size={"icon"} title="Toggle nightly load">
            {loader.reload_nightly ? (
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
            {loader.description}
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
    // <div className={cn("p-2", getColor(loader.color))}>
    //   <div className="flex flex-row items-center justify-evenly">
    //     <div className="flex">
    //       <span className="text-left text-xs font-light">{lastRunDate}</span>
    //       <span className="text-primary/80 text-xs">{lastRunTime}</span>
    //     </div>
    //     <span className="text-primary/80 text-sm">({loader.priority})</span>
    //     {actions.map((m, i) => (
    //       <div key={`load-stmt-action-${i}`}>
    //         <Link href={m.url} className="text-sm">
    //           {m.action}
    //         </Link>
    //         {i !== actions.length - 1 ? <span className="text-sm">|</span> : ""}
    //       </div>
    //     ))}
    //   </div>
    //   <div className="flex items-center justify-between">
    //     <div className="my-3 flex py-2 font-semibold">
    //    {" "}
    //     </div>

    //     <span className="w-18 text-left text-xs font-light tracking-tighter">
    //       ({runtime})
    //     </span>
    //     <div>
    //       <span className="font-semibold">Scale:</span> {loader.scale}
    //     </div>
    //   </div>

    //   <div>
    //     <p className="text-xs">{loader.description}</p>
    //     <p className="text-xs">{loader.eval}</p>
    //   </div>
    // </div>
  );
};
