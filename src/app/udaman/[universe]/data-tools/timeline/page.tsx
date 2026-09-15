import { listTimelineEventsAction } from "@/actions/timeline-events";
import { TimelineEventsManager } from "@/components/data-tools/timeline-events-manager";

export default async function TimelineEventsPage() {
  const events = await listTimelineEventsAction();
  return <TimelineEventsManager events={events} />;
}
