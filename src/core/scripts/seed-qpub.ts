/**
 * Enqueue a QPub seed job that queries the oldest TMKs and populates the scraper queue.
 *
 *   bun run seed:qpub
 */
import { enqueueQpubSeed } from "@/core/workers/enqueue";

const job = await enqueueQpubSeed();
console.log(`Enqueued QPub seed job (jobId: ${job.id})`);
process.exit(0);
