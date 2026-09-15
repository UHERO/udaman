import { listTimelineEventsAction } from "@/actions/timeline-events";
import { Analyzer } from "@/components/series/analyzer/analyzer";

export default async function AnalyzePage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe } = await params;
  const sp = await searchParams;

  // Parse URL params
  const namesParam = typeof sp.names === "string" ? sp.names : undefined;
  const exprsParam = typeof sp.exprs === "string" ? sp.exprs : undefined;
  const visParam = typeof sp.vis === "string" ? sp.vis : undefined;
  const axesParam = typeof sp.axes === "string" ? sp.axes : undefined;

  // Legacy backward compat: ?names=A,B → initialNames
  const initialNames = namesParam
    ? namesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  // New format: ?exprs="A".ts|"B".ts → initialExprs
  const initialExprs = exprsParam
    ? exprsParam.split("|").filter(Boolean)
    : undefined;

  const rawEvents = await listTimelineEventsAction();
  const timelineEvents = rawEvents.map((e) => ({
    id: e.id,
    start: e.startDate,
    end: e.effectiveEndDate,
    name: e.name,
    eventType: e.eventType,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
  }));

  return (
    <Analyzer
      initialNames={initialNames}
      initialExprs={initialExprs}
      initialVis={visParam}
      initialAxes={axesParam}
      universe={universe}
      timelineEvents={timelineEvents}
    />
  );
}
