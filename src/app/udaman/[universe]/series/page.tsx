import Link from "next/link";
import { redirect } from "next/navigation";
import type { SeriesListPreset } from "@catalog/collections/series-collection";
import type { Universe } from "@catalog/types/shared";
import { Plus } from "lucide-react";

import { getSeries, searchSeriesAction } from "@/actions/series-actions";
import { CalculateForm } from "@/components/series/calculate-form";
import { ClipboardButtons } from "@/components/series/clipboard-buttons";
import {
  PRESET_LABELS,
  SeriesListPresetSelect,
} from "@/components/series/series-list-preset-select";
import { SeriesListTable } from "@/components/series/series-list-table";
import { Button } from "@/components/ui/button";
import { isDbedt, isFsonly } from "@/lib/auth/authorization";
import { getCurrentUserContext } from "@/lib/auth/dal";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<{ q?: string; list?: string }>;
}) {
  const { universe } = await params;
  const u = universe as Universe;
  const { role, universe: userUniverse } = await getCurrentUserContext();

  // fsonly users get redirected to forecast
  if (isFsonly(role)) {
    redirect(`/udaman/${universe}/forecast`);
  }

  // DBEDT external users see a static message
  if (isDbedt(role, userUniverse)) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Data Series</h1>
        <p className="text-muted-foreground mt-2">
          Access not authorized for your current role.
        </p>
      </div>
    );
  }

  // Other external users (non-DBEDT) see a static message
  if (role === "external") {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Data Series</h1>
        <p className="text-muted-foreground mt-2">
          Your current role only gets to see this page. Contact an administrator
          for additional access.
        </p>
      </div>
    );
  }

  const { q, list } = await searchParams;
  const preset = (list ?? "recent-created") as SeriesListPreset;

  const data = await (q
    ? searchSeriesAction(q, u)
    : getSeries({ universe: u, preset }));

  const count = data.length ?? 0;
  const isSearch = Boolean(q);

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Data Series</h1>
        <p className="text-muted-foreground text-sm">
          {isSearch
            ? `Search: ${count} results`
            : `${PRESET_LABELS[preset] ?? "Recently Created"} — ${count} series`}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!isSearch && <SeriesListPresetSelect />}
        <ClipboardButtons seriesIds={data.map((s) => s.id)} />
        <CalculateForm />
        <Button className="cursor-pointer" asChild>
          <Link href={`/udaman/${universe}/series/create`}>
            <Plus className="mr-2 h-4 w-4" />
            Create Series
          </Link>
        </Button>
      </div>
      <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min">
        <SeriesListTable data={data} />
      </div>
    </>
  );
}
