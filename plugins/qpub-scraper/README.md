# QPub Scraper Chrome Extension

Chrome extension that scrapes QPub property pages and downloads HTML files to the NAS. Runs inside a real browser to avoid Cloudflare blocks.

## Setup

1. Set `SCRAPER_API_KEY` in your `.env` file
2. Start the Next.js dev server (`bun dev` on port 3008)
3. Open `chrome://extensions`, enable Developer mode
4. Click "Load unpacked" and select this `plugins/qpub-scraper/` directory

## Usage

1. Navigate to any QPub county search page
2. Click the extension icon in the toolbar
3. Configure API URL and API Key in Settings
4. Click **Start** — the active tab will be used for scraping
5. The first download shows a Save As dialog — navigate to `/Volumes/UHEROroot/work/scrapes/` and save
6. Subsequent downloads auto-save with the folder structure:
   ```
   qpub/html/{period}/{island}/{zone}/{section}/{tmk}.html
   ```
7. If a captcha appears, solve it in the tab — scraping resumes automatically
8. Click **Stop** to halt scraping

## Architecture

```
popup.html  ←→  service-worker.js  ←→  content.js (on QPub pages)
                      ↕
               udaman API routes
          /api/scraper/claim (GET)
          /api/scraper/status (POST)
```

- **content.js**: Runs on every QPub page. Detects blockers, captchas, and successful page loads. Reports status to the service worker.
- **service-worker.js**: Claims TMK batches from the API, navigates the tab, downloads HTML via Chrome Downloads API, reports status back.
- **popup**: UI for start/stop, status display, and settings.

## API Routes

- `GET /api/scraper/claim?size=10` — Claim a batch of TMKs to scrape
- `POST /api/scraper/status` — Report scrape result for a TMK

Both require `Authorization: Bearer <SCRAPER_API_KEY>` header.
