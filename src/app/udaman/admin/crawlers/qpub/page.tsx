import { notFound } from "next/navigation";

import { getQpubDbStats, getQpubScraperStatus } from "@/actions/crawlers";
import QpubScraperPanel from "@/components/admin/qpub-scraper-panel";
import { requireAuth } from "@/lib/auth/dal";

export default async function QpubCrawlerPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "admin" && role !== "dev") {
    notFound();
  }

  const [queueData, dbStats] = await Promise.all([
    getQpubScraperStatus(),
    getQpubDbStats(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">qPub Scraper</h1>
        <p className="text-muted-foreground text-sm">
          Monitor and manage the qPub property data scraper.
        </p>
      </div>

      <QpubScraperPanel initialQueueData={queueData} initialDbStats={dbStats} />
    </div>
  );
}
