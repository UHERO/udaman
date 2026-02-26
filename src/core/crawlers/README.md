# Crawlers

Web scrapers/crawlers that run as background BullMQ jobs. Each crawler lives in its own subdirectory under `src/core/crawlers/` and is wired into the worker system via a dedicated queue and processor.

## Directory structure

```
src/core/crawlers/<name>/
  config.ts      -- Constants, URL builders, helpers
  browser.ts     -- Browser lifecycle (launch, get page, close)
  scrape.ts      -- Pure scrape logic (no BullMQ awareness)

src/core/workers/
  queues.ts              -- Job name + data type + Queue instance
  enqueue.ts             -- Typed enqueue helpers (called by server actions)
  scraper-worker.ts      -- Worker that dispatches to processors
  processors/<name>.ts   -- Job processor (BullMQ-aware, calls scrape logic)
```

## Adding a new crawler

### 1. Crawler module (`src/core/crawlers/<name>/`)

**`config.ts`** -- Site-specific constants (base URLs, delay ranges, blocked hours, file paths). Export a `<NAME>_CONFIG` object.

**`browser.ts`** -- Manages a shared browser instance. Expose three functions:
- `getPage()` -- Returns a new tab from the shared browser context
- `releasePage(page)` -- Closes the tab
- `closeBrowser()` -- Tears down the entire browser session

Each concurrent job gets its own tab via `getPage()`. If the site detects automation (captcha, IP block), `closeBrowser()` burns the whole session so the next attempt starts fresh.

**`scrape.ts`** -- The actual scrape function. This must be **pure** (no BullMQ imports). It receives a Playwright `Page`, navigates, checks for blockers, saves results, and returns a typed result object. Rate-limiting jitter (`randomDelay()`) belongs here, **after** the page loads, to simulate human dwell time and keep failures fast.

### 2. Job definition (`src/core/workers/queues.ts`)

- Add a `JobName` constant (e.g. `MYSITE_SCRAPE: "scraper.mysite-scrape"`)
- Define a `MysiteScrapeJobData` type with the fields the processor needs
- The `scraperQueue` instance is shared across all crawlers

### 3. Enqueue helper (`src/core/workers/enqueue.ts`)

Add a typed function like:

```ts
export function enqueueMysiteScrape(data: MysiteScrapeJobData) {
  return scraperQueue.add(JobName.MYSITE_SCRAPE, data, {
    jobId: `mysite-scrape-${data.id}`,
  });
}
```

Use a deterministic `jobId` to deduplicate (prevents double-enqueuing the same target).

### 4. Processor (`src/core/workers/processors/<name>.ts`)

The processor is the BullMQ-aware glue between the queue and the pure scrape logic:

```ts
export async function processMysiteScrape(job: Job<MysiteScrapeJobData>): Promise<string> {
  // 1. Check blocked time windows, delay if needed
  // 2. getPage()
  // 3. Call the pure scrape function (jitter is inside it)
  // 4. Handle captcha/block → closeBrowser() + moveToDelayed()
  // 5. releasePage() in a finally block
}
```

### 5. Register the processor (`src/core/workers/scraper-worker.ts`)

Add the handler to the `handlers` map:

```ts
const handlers: Record<string, (job: Job) => Promise<string>> = {
  [JobName.MYSITE_SCRAPE]: processMysiteScrape,
};
```

### 6. Server action + UI trigger (`src/actions/`)

Create a server action that calls the enqueue helper. Wire it to a button/form in the admin UI.

## Concurrency

The scraper worker reads `SCRAPER_CONCURRENCY` from the environment (default `1`). Each concurrent job opens its own browser tab. Rate limiting is handled per-tab by the jitter delay inside the scrape function, not by BullMQ's limiter.

## Anti-detection conventions

- Use `playwright-extra` with the stealth plugin
- Randomize viewport dimensions per browser session
- Jitter between requests (4-20s) placed **after** page load to mimic reading time
- Respect blocked time windows (backup hours, nighttime)
- On captcha/block detection, close the entire browser and delay retry by 5 minutes
