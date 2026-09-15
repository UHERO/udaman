// QPub Scraper — Service Worker (MV3)
// Orchestrates scraping: claims TMKs from API, navigates tabs, downloads HTML.

// ─── Island config (from config.ts) ────────────────────────────────────

const ISLANDS = {
  "1": "Oahu",
  "2": "Maui",
  "3": "Hawaii",
  "4": "Kauai",
};

const BASE_URLS = {
  "1": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=1045&LayerID=23342&PageTypeID=4&PageID=9746&KeyValue=${parcel}`,
  "2": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&LayerID=21689&PageTypeID=4&PageID=9251&Q=665264273&KeyValue=${parcel}`,
  "3": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=1048&LayerID=23618&PageTypeID=4&PageID=9878&Q=252788940&KeyValue=${parcel}`,
  "4": (parcel) =>
    `https://qpublic.schneidercorp.com/Application.aspx?AppID=986&LayerID=20101&PageTypeID=4&PageID=8744&Q=1302490479&KeyValue=${parcel}`,
};

const DELAY_MIN = 4000;
const DELAY_MAX = 20000;

// ─── TMK helpers (from config.ts) ──────────────────────────────────────

function tmkToParcelNumber(tmk) {
  const parts = tmk.split("-");
  return parts.slice(1).join("");
}

function getIslandCode(tmk) {
  return tmk.split("-")[0];
}

function getZone(tmk) {
  return tmk.split("-")[1];
}

function getSection(tmk) {
  return tmk.split("-")[2];
}

function buildUrl(tmk, islandCode) {
  const parcel = tmkToParcelNumber(tmk);
  const builder = BASE_URLS[islandCode];
  if (!builder) throw new Error(`Unknown island code: ${islandCode}`);
  return builder(parcel);
}

// ─── Scrape period (from config.ts) ────────────────────────────────────

function getScrapePeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 3 && month <= 7) return `${year}-1`;
  if (month >= 9 && month <= 12) return `${year}-2`;
  throw new Error(`No active scrape period in month ${month}`);
}

// ─── Download path (from config.ts path building) ──────────────────────

function getDownloadPath(tmk) {
  const period = getScrapePeriod();
  const island = getIslandCode(tmk);
  const zone = getZone(tmk);
  const section = getSection(tmk);
  const safeName = tmk.replace(/\//g, "-");
  return `qpub/html/${period}/${island}/${zone}/${section}/${safeName}.html`;
}

// ─── Random delay (from scrape.ts) ─────────────────────────────────────

function randomDelay() {
  const base = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
  const variance = (Math.random() - 0.5) * 1000;
  const ms = Math.max(DELAY_MIN - 500, base + variance);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── State management ──────────────────────────────────────────────────

const DEFAULT_STATE = {
  running: false,
  apiUrl: "http://localhost:3008",
  apiKey: "",
  claimSize: 10,
  batch: [],
  batchIndex: 0,
  tabId: null,
  totalScraped: 0,
  totalErrors: 0,
  firstDownloadDone: false,
  currentTmk: null,
};

async function getState() {
  const data = await chrome.storage.local.get("scraperState");
  return { ...DEFAULT_STATE, ...data.scraperState };
}

async function setState(updates) {
  const current = await getState();
  const next = { ...current, ...updates };
  await chrome.storage.local.set({ scraperState: next });
  return next;
}

// ─── API helpers ───────────────────────────────────────────────────────

async function apiClaim(state) {
  const url = `${state.apiUrl}/api/scraper/claim?size=${state.claimSize}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${state.apiKey}` },
  });
  if (!resp.ok) {
    throw new Error(`Claim API error: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

async function apiStatus(state, tmk, status, error) {
  const url = `${state.apiUrl}/api/scraper/status`;
  const body = { tmk, status };
  if (error) body.error = error;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.warn(`Status API error: ${resp.status} ${resp.statusText}`);
  }
}

// ─── Keepalive alarm ───────────────────────────────────────────────────

chrome.alarms.create("keepalive", { periodInMinutes: 25 / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "keepalive") {
    const state = await getState();
    if (state.running) {
      console.log("[keepalive] Service worker alive, running =", state.running);
    }
  }
});

// ─── Content script port (keeps SW alive) ──────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "qpub-content") {
    // Just holding the port keeps the service worker alive
    port.onDisconnect.addListener(() => {
      console.log("[port] Content script disconnected");
    });
  }
});

// ─── Message handling ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "page-status") {
    handlePageStatus(message).catch(console.error);
  } else if (message.type === "start") {
    handleStart(message).catch(console.error);
    sendResponse({ ok: true });
  } else if (message.type === "stop") {
    handleStop().catch(console.error);
    sendResponse({ ok: true });
  } else if (message.type === "get-state") {
    getState().then(sendResponse);
    return true; // async response
  } else if (message.type === "update-settings") {
    setState({
      apiUrl: message.apiUrl,
      apiKey: message.apiKey,
      claimSize: message.claimSize,
    })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// ─── Start scraping ────────────────────────────────────────────────────

async function handleStart(message) {
  const state = await setState({
    running: true,
    tabId: message.tabId,
    totalScraped: 0,
    totalErrors: 0,
    firstDownloadDone: false,
    currentTmk: null,
    batch: [],
    batchIndex: 0,
  });

  broadcastState(state);
  await claimAndProcess();
}

async function handleStop() {
  const state = await setState({
    running: false,
    currentTmk: null,
    batch: [],
    batchIndex: 0,
  });
  broadcastState(state);
}

// ─── Core scrape loop ──────────────────────────────────────────────────

async function claimAndProcess() {
  let state = await getState();
  if (!state.running) return;

  // Claim a batch if we need one
  if (state.batchIndex >= state.batch.length) {
    try {
      const data = await apiClaim(state);
      if (!data.items || data.items.length === 0) {
        console.log("[scraper] No items to claim — stopping");
        await handleStop();
        return;
      }
      state = await setState({ batch: data.items, batchIndex: 0 });
    } catch (e) {
      console.error("[scraper] Claim failed:", e.message);
      // Retry after delay
      setTimeout(claimAndProcess, 30000);
      return;
    }
  }

  await processNextItem();
}

async function processNextItem() {
  const state = await getState();
  if (!state.running) return;

  if (state.batchIndex >= state.batch.length) {
    // Batch exhausted — claim next
    await claimAndProcess();
    return;
  }

  const item = state.batch[state.batchIndex];
  const { tmk, island_code } = item;

  if (!(island_code in ISLANDS)) {
    console.warn(`[scraper] Unknown island code ${island_code} for ${tmk}`);
    await apiStatus(state, tmk, "error", `unknown island code: ${island_code}`);
    await setState({ batchIndex: state.batchIndex + 1 });
    await processNextItem();
    return;
  }

  // Validate parcel number — zone (second segment) should never start with 0
  const parcel = tmkToParcelNumber(tmk);
  if (parcel.startsWith("0")) {
    console.warn(`[scraper] Invalid parcel number ${parcel} for ${tmk} — skipping`);
    await apiStatus(state, tmk, "error", `invalid parcel number: ${parcel}`);
    state = await setState({
      totalErrors: state.totalErrors + 1,
      batchIndex: state.batchIndex + 1,
    });
    broadcastState(state);
    await processNextItem();
    return;
  }

  const url = buildUrl(tmk, island_code);
  await setState({ currentTmk: tmk });
  broadcastState(await getState());

  console.log(`[scraper] Navigating to ${tmk} → ${url}`);

  try {
    await chrome.tabs.update(state.tabId, { url });
  } catch (e) {
    console.error(`[scraper] Tab navigation failed:`, e.message);
    await handleStop();
  }
  // Content script will send page-status when loaded
}

// ─── Handle page status from content script ────────────────────────────

async function handlePageStatus(message) {
  let state = await getState();
  if (!state.running || !state.currentTmk) return;

  const tmk = state.currentTmk;

  switch (message.status) {
    case "success":
    case "captcha-resolved": {
      // Download the HTML
      const html = message.html;
      if (!html) {
        console.warn(`[scraper] No HTML for ${tmk}`);
        break;
      }

      try {
        await downloadHtml(tmk, html, state);
        await apiStatus(state, tmk, "success");
        state = await setState({
          totalScraped: state.totalScraped + 1,
          batchIndex: state.batchIndex + 1,
          currentTmk: null,
        });
      } catch (e) {
        console.error(`[scraper] Download/status failed for ${tmk}:`, e.message);
        await apiStatus(state, tmk, "error", e.message);
        state = await setState({
          totalErrors: state.totalErrors + 1,
          batchIndex: state.batchIndex + 1,
          currentTmk: null,
        });
      }

      broadcastState(state);

      // Delay then next
      await randomDelay();
      await processNextItem();
      break;
    }

    case "captcha": {
      console.log(`[scraper] Captcha detected for ${tmk} — waiting for user`);
      await apiStatus(state, tmk, "captcha", message.error);
      broadcastState(await getState());
      // Content script will poll and send captcha-resolved
      break;
    }

    case "blocked": {
      console.warn(`[scraper] Blocked for ${tmk}`);
      await apiStatus(state, tmk, "blocked", message.error);
      state = await setState({
        totalErrors: state.totalErrors + 1,
        batchIndex: state.batchIndex + 1,
        currentTmk: null,
      });
      broadcastState(state);
      await randomDelay();
      await processNextItem();
      break;
    }

    case "unknown": {
      console.warn(`[scraper] Unknown page status for ${tmk} — saving HTML for debugging`);

      // Still download what we got (mirrors scrape.ts no_data behavior)
      if (message.html) {
        try {
          await downloadHtml(tmk, message.html, state);
        } catch (e) {
          console.warn(`[scraper] Debug download failed for ${tmk}:`, e.message);
        }
      }

      await apiStatus(state, tmk, "success");
      state = await setState({
        totalScraped: state.totalScraped + 1,
        batchIndex: state.batchIndex + 1,
        currentTmk: null,
      });
      broadcastState(state);
      await randomDelay();
      await processNextItem();
      break;
    }
  }
}

// ─── Download HTML via Chrome Downloads API ────────────────────────────

function uint8ToBase64(uint8) {
  const CHUNK = 0x8000;
  const parts = [];
  for (let i = 0; i < uint8.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, uint8.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

async function downloadHtml(tmk, html, state) {
  const filename = getDownloadPath(tmk);

  // Use data URL — blob URLs don't work in MV3 service workers
  const base64 = uint8ToBase64(new TextEncoder().encode(html));
  const dataUrl = `data:text/html;base64,${base64}`;

  const downloadOptions = {
    url: dataUrl,
    filename,
    conflictAction: "overwrite",
    saveAs: !state.firstDownloadDone,
  };

  return new Promise((resolve, reject) => {
    chrome.downloads.download(downloadOptions, async (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!state.firstDownloadDone) {
        await setState({ firstDownloadDone: true });
      }

      resolve(downloadId);
    });
  });
}

// ─── Broadcast state to popup ──────────────────────────────────────────

function broadcastState(state) {
  chrome.runtime
    .sendMessage({
      type: "state-update",
      state: {
        running: state.running,
        currentTmk: state.currentTmk,
        totalScraped: state.totalScraped,
        totalErrors: state.totalErrors,
        batchIndex: state.batchIndex,
        batchSize: state.batch.length,
      },
    })
    .catch(() => {
      // Popup not open — ignore
    });
}

// ─── Restart on service worker wake ────────────────────────────────────

(async () => {
  const state = await getState();
  if (state.running) {
    console.log("[scraper] Service worker restarted — resuming from batch index", state.batchIndex);
    await processNextItem();
  }
})();
