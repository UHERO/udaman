// QPub Scraper — Popup Script

const $ = (sel) => document.querySelector(sel);

const statusText = $("#status-text");
const currentTmk = $("#current-tmk");
const scrapedCount = $("#scraped-count");
const errorCount = $("#error-count");
const batchProgress = $("#batch-progress");
const btnStart = $("#btn-start");
const btnStop = $("#btn-stop");
const btnSave = $("#btn-save-settings");
const inputApiUrl = $("#input-api-url");
const inputApiKey = $("#input-api-key");
const inputClaimSize = $("#input-claim-size");

// ─── Load saved settings ──────────────────────────────────────────────

chrome.runtime.sendMessage({ type: "get-state" }, (state) => {
  if (!state) return;
  inputApiUrl.value = state.apiUrl || "http://localhost:3008";
  inputApiKey.value = state.apiKey || "";
  inputClaimSize.value = state.claimSize || 10;
  updateUI(state);
});

// ─── UI Updates ───────────────────────────────────────────────────────

function updateUI(state) {
  if (state.running) {
    statusText.textContent = "Running";
    statusText.className = "value running";
    btnStart.disabled = true;
    btnStop.disabled = false;
  } else {
    statusText.textContent = "Stopped";
    statusText.className = "value stopped";
    btnStart.disabled = false;
    btnStop.disabled = true;
  }

  currentTmk.textContent = state.currentTmk || "—";
  scrapedCount.textContent = state.totalScraped ?? 0;
  errorCount.textContent = state.totalErrors ?? 0;

  if (state.batchSize > 0) {
    batchProgress.textContent = `${state.batchIndex ?? 0} / ${state.batchSize}`;
  } else {
    batchProgress.textContent = "—";
  }
}

// ─── Listen for state broadcasts ──────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "state-update") {
    updateUI(message.state);
  }
});

// ─── Start button ─────────────────────────────────────────────────────

btnStart.addEventListener("click", async () => {
  // Validate settings
  const apiUrl = inputApiUrl.value.trim();
  const apiKey = inputApiKey.value.trim();

  if (!apiKey) {
    alert("Please enter an API key in Settings.");
    return;
  }

  // Save settings first
  await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "update-settings",
        apiUrl,
        apiKey,
        claimSize: parseInt(inputClaimSize.value, 10) || 10,
      },
      resolve,
    );
  });

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    alert("No active tab found.");
    return;
  }

  chrome.runtime.sendMessage({ type: "start", tabId: tab.id });

  btnStart.disabled = true;
  btnStop.disabled = false;
  statusText.textContent = "Starting...";
  statusText.className = "value running";
});

// ─── Stop button ──────────────────────────────────────────────────────

btnStop.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "stop" });
});

// ─── Save settings ────────────────────────────────────────────────────

btnSave.addEventListener("click", () => {
  chrome.runtime.sendMessage(
    {
      type: "update-settings",
      apiUrl: inputApiUrl.value.trim(),
      apiKey: inputApiKey.value.trim(),
      claimSize: parseInt(inputClaimSize.value, 10) || 10,
    },
    (resp) => {
      if (resp?.ok) {
        btnSave.textContent = "Saved!";
        setTimeout(() => {
          btnSave.textContent = "Save Settings";
        }, 1500);
      }
    },
  );
});
