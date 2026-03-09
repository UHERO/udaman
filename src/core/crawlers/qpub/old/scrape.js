#!/usr/bin/env node
/**
 * QPub Scraper with MySQL Queue - Multi-tab support
 * Distributed scraping using MySQL for coordination
 * Date: 2025-10-13
 */
import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import readline from "readline";

import mysql from "mysql2/promise";
import { chromium, firefox, webkit } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { parsePropertyHTML } from "./parse.js";
import { CONFIG, getHtmlPath, getJsonPath } from "./shared.js";

// Prompt user for input
function prompt(question, defaultValue = "") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      // Remove all readline listeners
      process.stdin.removeAllListeners("keypress");
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Get configuration from user
async function getConfig() {
  console.log("QPub MySQL Scraper - Configuration\n");
  console.log("Press ENTER to use defaults shown in brackets\n");

  const numTabs = await prompt(`Number of tabs (1-3) [1]: `, "1");
  const browserType = await prompt(
    `Browser (chromium/firefox/webkit) [chromium]: `,
    "chromium",
  );
  const workerId = await prompt(
    `Leaderboard name [${os.hostname()}]: `,
    os.hostname(),
  );
  const enableSound = await prompt(`Enable sound alerts? (y/n) [y]: `, "y");

  console.log(""); // Add blank line after prompts

  // Clean up stdin after prompts
  process.stdin.removeAllListeners("data");
  process.stdin.pause();

  return {
    numTabs: Math.max(1, Math.min(3, parseInt(numTabs) || 3)),
    browserType: ["chromium", "firefox", "webkit"].includes(browserType)
      ? browserType
      : "chromium",
    workerId,
    enableSound: enableSound.toLowerCase() !== "n",
  };
}

// These will be set after prompts
let NUM_TABS;
let BROWSER_TYPE;
let WORKER_ID;
let ENABLE_SOUND;
const MAX_TABS = 3;

// Browser engines - stealth plugin will be applied to selected browser only
const browserEngines = { chromium, firefox, webkit };
let browser;

// Add WORKER_ID to CONFIG (will be set after prompts)
CONFIG.WORKER_ID = null;

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Global state
const tabStates = [];
const waitingQueue = [];
let queueStats = { pending: 0, claimed: 0, completed: 0, failed: 0 };
let stopMusicFn = null;
let playNotification = null;
let browserInstance = null;
let isShuttingDown = false;

// MySQL connection pool
const db = mysql.createPool({
  host: CONFIG.MYSQL_HOST,
  port: 3306,
  database: "qpub_scraper",
  user: CONFIG.MYSQL_USER,
  password: CONFIG.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 45000,
});

// Get status emoji
function getStatusEmoji(status) {
  switch (status) {
    case "starting":
      return "🔵";
    case "running":
      return "🔄";
    case "waiting":
      return "⏸️";
    case "sleeping":
      return "💤";
    case "completed":
      return "✅";
    case "error":
      return "❌";
    default:
      return "⚪";
  }
}

// Clear screen
function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

// Display status dashboard
function displayStatus() {
  clearScreen();

  const totalScraped = tabStates.reduce(
    (sum, tab) => sum + tab.scrapedCount,
    0,
  );
  const totalFailed = tabStates.reduce((sum, tab) => sum + tab.failedCount, 0);
  const totalRecords =
    queueStats.pending +
    queueStats.claimed +
    queueStats.completed +
    queueStats.failed;
  const percentComplete =
    totalRecords > 0
      ? ((queueStats.completed / totalRecords) * 100).toFixed(1)
      : 0;

  console.log(
    `${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}${colors.cyan}  QPub MySQL Scraper  (${NUM_TABS} tab${NUM_TABS > 1 ? "s" : ""}) - Worker: ${CONFIG.WORKER_ID}${colors.reset}`,
  );
  console.log(
    `${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`,
  );

  console.log(`${colors.bright}Queue Status:${colors.reset}`);
  console.log(
    `  Pending: ${colors.yellow}${queueStats.pending}${colors.reset} | Claimed: ${colors.blue}${queueStats.claimed}${colors.reset} | Completed: ${colors.green}${queueStats.completed}${colors.reset} | Failed: ${colors.red}${queueStats.failed}${colors.reset}`,
  );
  console.log(
    `  Progress: ${queueStats.completed}/${totalRecords} (${percentComplete}%)\n`,
  );

  console.log(
    `${colors.bright}Worker Stats:${colors.reset} ${totalScraped} scraped | ${totalFailed} failed\n`,
  );

  // Display each tab status
  tabStates.forEach((tab) => {
    const emoji = getStatusEmoji(tab.status);
    const statusColor =
      tab.status === "waiting"
        ? colors.yellow
        : tab.status === "running"
          ? colors.green
          : tab.status === "sleeping"
            ? colors.cyan
            : tab.status === "error"
              ? colors.red
              : colors.dim;

    let statusLine = `${emoji} ${colors.bright}Tab #${tab.id}${colors.reset} - ${statusColor}${tab.status.toUpperCase()}${colors.reset}`;

    if (tab.currentTMK) {
      statusLine += ` ${colors.dim}| TMK: ${tab.currentTMK}${colors.reset}`;
    }

    console.log(statusLine);

    // Show last 3 logs for this tab with indicator for most recent
    if (tab.logs && tab.logs.length > 0) {
      const recentLogs = tab.logs.slice(-3);
      recentLogs.forEach((log, index) => {
        const isLatest = index === recentLogs.length - 1;
        const indicator = isLatest ? ">" : " ";
        console.log(`  ${indicator} ${colors.dim}${log}${colors.reset}`);
      });
    }

    console.log("");
  });

  // Display waiting queue info
  if (waitingQueue.length > 0) {
    console.log(
      `${colors.yellow}${colors.bright}Waiting for captcha resolution:${colors.reset}`,
    );
    waitingQueue.forEach((tab, index) => {
      const marker = index === 0 ? "← Next" : "";
      const waitTime = Math.floor((Date.now() - tab.waitingSince) / 1000);
      console.log(
        `  ${colors.yellow}[Tab ${tab.id}]${colors.reset} ${colors.dim}(${waitTime}s ago)${colors.reset} ${colors.green}${marker}${colors.reset}`,
      );
    });
    console.log("");
    console.log(
      `${colors.bright}${colors.green}Press ENTER to continue Tab #${waitingQueue[0].id}...${colors.reset}\n`,
    );
  } else {
    console.log(`${colors.dim}All tabs running...${colors.reset}\n`);
  }

  console.log(
    `${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(`${colors.dim}Tip: Press Ctrl+C to stop all tabs${colors.reset}`);
}

// Add log to tab
function addLog(tabId, message) {
  const tab = tabStates.find((t) => t.id === tabId);
  if (tab) {
    if (!tab.logs) tab.logs = [];
    tab.logs.push(message);
    if (tab.logs.length > 10) tab.logs.shift(); // Keep max 10 logs
    displayStatus();
  }
}

// Update tab status
function updateTabStatus(tabId, status, currentTMK = null) {
  const tab = tabStates.find((t) => t.id === tabId);
  if (tab) {
    tab.status = status;
    if (currentTMK !== null) tab.currentTMK = currentTMK;
    displayStatus();
  }
}

// Check if current time is during backup window (7 PM - 8 PM)
function isBackupTime() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= CONFIG.BACKUP_START_HOUR && hour < CONFIG.BACKUP_END_HOUR;
}

// Check if current time is during nighttime block (11 PM - 5 AM)
function isNighttime() {
  const now = new Date();
  const hour = now.getHours();
  // Nighttime spans midnight, so we check if hour >= 23 OR hour < 5
  return (
    hour >= CONFIG.NIGHTTIME_START_HOUR || hour < CONFIG.NIGHTTIME_END_HOUR
  );
}

// Check if in any blocked period
function isBlockedTime() {
  return isBackupTime() || isNighttime();
}

// Get time until backup window or end of backup
function getTimeUntilBackup() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour < CONFIG.BACKUP_START_HOUR) {
    // Before backup window
    const hoursUntil = CONFIG.BACKUP_START_HOUR - hour - 1;
    const minutesUntil = 60 - minute;
    return `${hoursUntil}h ${minutesUntil}m`;
  } else if (hour >= CONFIG.BACKUP_END_HOUR) {
    // After backup window - time until tomorrow's backup
    const hoursUntil = 24 - hour + CONFIG.BACKUP_START_HOUR - 1;
    const minutesUntil = 60 - minute;
    return `${hoursUntil}h ${minutesUntil}m`;
  } else {
    // During backup window - time until it ends
    const minutesUntil = 60 - minute;
    return `${minutesUntil}m`;
  }
}

// Get time until nighttime ends (5 AM)
function getTimeUntilMorning() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour >= CONFIG.NIGHTTIME_START_HOUR) {
    // After 11 PM - time until 5 AM tomorrow
    const hoursUntil = 24 - hour + CONFIG.NIGHTTIME_END_HOUR - 1;
    const minutesUntil = 60 - minute;
    return `${hoursUntil}h ${minutesUntil}m`;
  } else {
    // Before 5 AM - time until 5 AM today
    const hoursUntil = CONFIG.NIGHTTIME_END_HOUR - hour - 1;
    const minutesUntil = 60 - minute;
    return `${hoursUntil}h ${minutesUntil}m`;
  }
}

// Get milliseconds until backup window ends
function getMsUntilBackupEnds() {
  const now = new Date();
  const endTime = new Date();
  endTime.setHours(CONFIG.BACKUP_END_HOUR, 0, 0, 0);

  // If we're past the backup end time today, this shouldn't be called
  return endTime - now;
}

// Get milliseconds until nighttime ends (5 AM)
function getMsUntilMorning() {
  const now = new Date();
  const endTime = new Date();

  if (now.getHours() >= CONFIG.NIGHTTIME_START_HOUR) {
    // After 11 PM - wait until 5 AM tomorrow
    endTime.setDate(endTime.getDate() + 1);
  }

  endTime.setHours(CONFIG.NIGHTTIME_END_HOUR, 0, 0, 0);
  return endTime - now;
}

// Sleep with periodic status updates
async function sleepUntilResume(reason) {
  const isBackup = reason === "backup";
  const getMsRemaining = isBackup ? getMsUntilBackupEnds : getMsUntilMorning;
  const getTimeString = isBackup ? getTimeUntilBackup : getTimeUntilMorning;
  const emoji = isBackup ? "⏰" : "🌙";
  const periodName = isBackup ? "Backup window" : "Nighttime block";

  while (isBlockedTime()) {
    // Update display
    clearScreen();
    displayStatus();
    const timeRemaining = getTimeString();
    console.log(
      `\n${colors.yellow}${emoji} ${periodName} - Sleeping...${colors.reset}`,
    );
    console.log(
      `${colors.green}Will resume in ${timeRemaining}${colors.reset}\n`,
    );

    // Sleep for 1 minute or until block ends (whichever is shorter)
    const msRemaining = getMsRemaining();
    const sleepMs = Math.min(60000, msRemaining);

    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }

    // Check again
    if (!isBlockedTime()) {
      clearScreen();
      displayStatus();
      console.log(
        `\n${colors.green}${emoji} ${periodName} ended - resuming scraping!${colors.reset}\n`,
      );
      break;
    }
  }
}

// Update queue stats
async function updateQueueStats() {
  try {
    const [stats] = await db.query(`
      SELECT status, COUNT(*) as count
      FROM scrape_queue
      GROUP BY status
    `);

    queueStats = { pending: 0, claimed: 0, completed: 0, failed: 0 };
    for (const row of stats) {
      queueStats[row.status] = parseInt(row.count);
    }
  } catch (error) {
    // Ignore errors during stats update
  }
}

// Claim next TMK from queue (atomic operation)
async function claimNextTMK() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Use FOR UPDATE SKIP LOCKED for atomic claiming
    // Order by type to prioritize parcels (phase 1) before condos (phase 2)
    const [result] = await connection.query(`
      SELECT tmk, qpub_link
      FROM scrape_queue
      WHERE status IN ('pending', 'failed')
      AND retry_count < 3
      LIMIT 1
    `);

    if (result.length === 0) {
      await connection.rollback();
      connection.release();
      return null;
    }

    const record = result[0];

    // Update status to claimed
    await connection.query(
      `
      UPDATE scrape_queue
      SET status = 'claimed',
          claimed_at = NOW(),
          claimed_by = ?
      WHERE tmk = ?
    `,
      [CONFIG.WORKER_ID, record.tmk],
    );

    await connection.commit();
    connection.release();

    return record;
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error("Error claiming TMK:", error.message);
    return null;
  }
}

// Mark TMK as completed
async function markCompleted(tmk) {
  await db.query(
    `
    UPDATE scrape_queue
    SET status = 'completed',
        completed_at = NOW(),
        scraped_by = ?
    WHERE tmk = ?
  `,
    [CONFIG.WORKER_ID, tmk],
  );
}

// Mark TMK as failed
async function markFailed(tmk, errorMessage) {
  await db.query(
    `
    UPDATE scrape_queue
    SET status = 'failed',
        retry_count = retry_count + 1,
        error_message = ?
    WHERE tmk = ?
  `,
    [errorMessage, tmk],
  );
}

// Check for captcha
async function checkForBlockers(page) {
  try {
    const qpubCaptcha = await page.$(".g-recaptcha");
    if (qpubCaptcha) {
      return { blocked: true, type: "qpub_captcha" };
    }

    const unblockButton = await page.$("a#btnSubmit");
    if (unblockButton) {
      return { blocked: true, type: "qpub_captcha" };
    }

    return { blocked: false };
  } catch (e) {
    return { blocked: false };
  }
}

// Focus browser
async function focusBrowser(page) {
  try {
    await page.bringToFront();
  } catch (e) {
    // Ignore
  }
}

// Check page status and extract data
async function checkPageStatus(page) {
  try {
    const html = await page.content();

    // Check for Cloudflare block
    if (
      html.includes("Sorry, you have been blocked") ||
      html.includes("Cloudflare Ray ID")
    ) {
      return { status: "blocked", data: null };
    }

    // Check for valid parcel page by looking for the Parcel Number table row
    // Valid pages have a <tr> with <th>Parcel Number</th> and <td> containing digits
    const parcelRowPattern =
      /<tr[^>]*>[\s\S]*?<th[^>]*>[\s\S]*?Parcel Number[\s\S]*?<\/th>[\s\S]*?<td[^>]*>[\s\S]*?\d+[\s\S]*?<\/td>[\s\S]*?<\/tr>/;

    if (parcelRowPattern.test(html)) {
      // Page has valid parcel data - return success
      return { status: "success", data: html };
    }

    // Unknown state (no valid parcel data found)
    return { status: "unknown", data: null };
  } catch (e) {
    return { status: "error", data: null };
  }
}

// Save HTML and result
async function saveResult(tmk, html, pageStatus) {
  const resultsDir = path.join(CONFIG.NAS_PATH, CONFIG.RESULTS_DIR);

  // Extract island code
  const islandCode = tmk.split(/[-\/]/)[0];

  // Get nested directories (by island/zone/section)
  const htmlNestedDir = getHtmlPath(islandCode, tmk);
  const jsonNestedDir = getJsonPath(islandCode, tmk);
  const resultsIslandDir = path.join(resultsDir, islandCode);

  // Create subdirectories
  if (!existsSync(htmlNestedDir)) {
    await fs.mkdir(htmlNestedDir, { recursive: true });
  }
  if (!existsSync(resultsIslandDir)) {
    await fs.mkdir(resultsIslandDir, { recursive: true });
  }

  // Save HTML
  const htmlFilename = `${tmk.replace(/\//g, "-")}.html`;
  const htmlPath = path.join(htmlNestedDir, htmlFilename);
  await fs.writeFile(htmlPath, html);

  // Save result with status
  const resultFilename = `${tmk.replace(/\//g, "-")}.json`;
  const resultPath = path.join(resultsIslandDir, resultFilename);
  await fs.writeFile(
    resultPath,
    JSON.stringify(
      {
        tmk,
        status: pageStatus,
        scraped_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  // Parse HTML and save parsed JSON (real-time parsing)
  try {
    const parsedData = parsePropertyHTML(html, tmk);

    // Create JSON directory if needed
    if (!existsSync(jsonNestedDir)) {
      await fs.mkdir(jsonNestedDir, { recursive: true });
    }

    // Save parsed JSON
    const jsonPath = path.join(
      jsonNestedDir,
      `${tmk.replace(/\//g, "-")}.json`,
    );
    await fs.writeFile(jsonPath, JSON.stringify(parsedData, null, 2));

    // Update database with parse results
    await db.query(
      `UPDATE scrape_queue
       SET parsed = TRUE,
           parsed_at = NOW(),
           parse_status = ?
       WHERE tmk = ?`,
      [parsedData.status, tmk],
    );
  } catch (parseError) {
    // Log parse error but don't fail the scrape
    console.error(`Parse error for ${tmk}:`, parseError.message);
    await db.query(
      `UPDATE scrape_queue
       SET parsed = FALSE,
           parse_status = 'failed'
       WHERE tmk = ?`,
      [tmk],
    );
  }
}

// Random delay - uses CONFIG.DELAY_MIN and CONFIG.DELAY_MAX with additional variance
function randomDelay() {
  const baseDelay =
    CONFIG.DELAY_MIN + Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN);
  const variance = (Math.random() - 0.5) * 1000; // +/- 0.5 seconds
  const delay = Math.max(CONFIG.DELAY_MIN - 500, baseDelay + variance);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Generate random viewport size (typical desktop sizes but varied)
function getRandomViewport() {
  // Common desktop resolutions, but randomized within ranges
  const widths = [1280, 1366, 1440, 1536];
  const heights = [720, 768, 900, 960, 1024];

  const baseWidth = widths[Math.floor(Math.random() * widths.length)];
  const baseHeight = heights[Math.floor(Math.random() * heights.length)];

  // Add some randomness (+/- 50 pixels)
  const width = baseWidth + Math.floor(Math.random() * 100) - 50;
  const height = baseHeight + Math.floor(Math.random() * 100) - 50;

  return { width, height };
}

// Scrape function for a single tab
async function scrapeTab(page, tabId) {
  const tabState = tabStates.find((t) => t.id === tabId);

  while (true) {
    // Check if shutdown has been initiated
    if (isShuttingDown) {
      updateTabStatus(tabId, "completed", "Shutting down");
      addLog(tabId, "👋 Shutdown initiated - stopping gracefully");
      return tabState.scrapedCount;
    }

    // Check if we've entered a blocked time period
    if (isBackupTime()) {
      updateTabStatus(tabId, "sleeping", "Backup window");
      addLog(tabId, "⏰ Backup window started - sleeping until it ends");
      await sleepUntilResume("backup");
      addLog(tabId, "✅ Backup complete - resuming scraping");
      updateTabStatus(tabId, "idle", null);
    }

    if (isNighttime()) {
      updateTabStatus(tabId, "sleeping", "Nighttime");
      addLog(tabId, "🌙 Nighttime block started - sleeping until morning");
      await sleepUntilResume("nighttime");
      addLog(tabId, "✅ Morning arrived - resuming scraping");
      updateTabStatus(tabId, "idle", null);
    }

    // Claim next TMK
    const record = await claimNextTMK();

    if (!record) {
      updateTabStatus(tabId, "completed", "Done");
      addLog(tabId, "✅ Queue is empty - all done!");
      break;
    }

    updateTabStatus(tabId, "running", record.tmk);
    addLog(tabId, `🔁 Working on ${record.tmk}`);

    try {
      // Navigate to page
      await randomDelay();
      await page.goto(record.qpub_link, {
        waitUntil: "domcontentloaded",
        timeout: CONFIG.DELAY_MAX + 3000,
      });

      // Check for blockers
      const blocker = await checkForBlockers(page);
      if (blocker.blocked) {
        updateTabStatus(tabId, "waiting", record.tmk);
        addLog(tabId, "⚠️  CAPTCHA DETECTED!");

        // Add to waiting queue if not already there
        if (!waitingQueue.find((t) => t.id === tabId)) {
          tabState.waitingSince = Date.now();
          waitingQueue.push(tabState);

          // Focus browser window for first in queue
          if (waitingQueue[0].id === tabId) {
            await focusBrowser(page);
            // Play music if enabled
            if (playNotification && !stopMusicFn) {
              stopMusicFn = playNotification();
            }
          }
        }

        displayStatus();

        // Wait until this tab is released from waiting
        await new Promise((resolve) => {
          tabState.resolveWait = resolve;
        });

        // Continue after captcha is solved
        updateTabStatus(tabId, "running", record.tmk);
        addLog(tabId, "Continuing after captcha...");
      }

      // Check page status
      const pageResult = await checkPageStatus(page);

      if (pageResult.status === "blocked") {
        addLog(tabId, `🚫 Blocked by Cloudflare`);
        await markFailed(record.tmk, "Blocked by Cloudflare");
        tabState.failedCount++;
      } else if (pageResult.status === "no_data") {
        addLog(tabId, `⚠️  No data available`);
        const html = await page.content();
        await saveResult(record.tmk, html, "no_data");
        await markCompleted(record.tmk);
        tabState.scrapedCount++;
      } else if (pageResult.status === "success") {
        addLog(tabId, `🏠 Parcel data found`);
        const html = await page.content();
        await saveResult(record.tmk, html, "success");
        await markCompleted(record.tmk);
        tabState.scrapedCount++;
      } else {
        addLog(tabId, `❓ Unknown page state`);
        const html = await page.content();
        await saveResult(record.tmk, html, "unknown");
        await markCompleted(record.tmk);
        tabState.scrapedCount++;
      }

      addLog(
        tabId,
        `💾 Saved (${tabState.scrapedCount} completed, ${tabState.failedCount} failed)`,
      );

      // Update queue stats every 10 records
      if ((tabState.scrapedCount + tabState.failedCount) % 30 === 0) {
        await updateQueueStats();
      }
    } catch (error) {
      updateTabStatus(tabId, "error", record.tmk);
      addLog(tabId, `❌ Error: ${error.message}`);
      await markFailed(record.tmk, error.message);
      tabState.failedCount++;

      // Continue to next record despite error
      await new Promise((resolve) => setTimeout(resolve, 2000));
      updateTabStatus(tabId, "running", null);
    }
  }

  return tabState.scrapedCount;
}

// Graceful shutdown handler
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n\nShutting down gracefully...");

  // 0. Wait a moment for tabs to notice shutdown flag and stop
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 1. Reset any claimed records back to pending
  if (CONFIG.WORKER_ID) {
    try {
      const [result] = await db.query(
        `UPDATE scrape_queue
         SET status = 'pending', claimed_at = NULL, claimed_by = NULL
         WHERE status = 'claimed' AND claimed_by = ?`,
        [CONFIG.WORKER_ID],
      );
      if (result.affectedRows > 0) {
        console.log(
          `✓ Reset ${result.affectedRows} claimed record(s) back to pending`,
        );
      } else {
        console.log("✓ No claimed records to reset");
      }
    } catch (err) {
      console.error("Failed to reset claimed records:", err.message);
    }
  }

  // 2. Close browser
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log("✓ Browser closed");
    } catch (err) {
      // Ignore errors on browser close
    }
  }

  // 3. Close database pool
  try {
    await db.end();
    console.log("✓ Database connection closed");
  } catch (err) {
    // Ignore errors on pool close
  }

  console.log("Goodbye!\n");
  process.exit(0);
}

// Setup input handler
function setupInputHandler() {
  // Set up Ctrl+C handler
  process.on("SIGINT", gracefulShutdown);
  process.on("SIGTERM", gracefulShutdown);

  // Resume stdin and make it raw mode for Enter key detection
  process.stdin.resume();
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", async (key) => {
    // Check for Ctrl+C manually as backup
    if (key === "\u0003") {
      await gracefulShutdown();
      return;
    }

    // Check for Enter key
    if (key === "\r" || key === "\n") {
      if (waitingQueue.length > 0) {
        // Get first tab in queue
        const tab = waitingQueue.shift();

        // Stop music if no more tabs waiting
        if (waitingQueue.length === 0 && stopMusicFn) {
          stopMusicFn();
          stopMusicFn = null;
        } else if (waitingQueue.length > 0) {
          // Focus next waiting tab's browser
          const nextTab = waitingQueue[0];
          const page = tabStates.find((t) => t.id === nextTab.id).page;
          await focusBrowser(page);
        }

        // Resolve the wait promise for this tab
        if (tab.resolveWait) {
          tab.resolveWait();
          tab.resolveWait = null;
        }

        displayStatus();
      }
    }
  });
}

// Main scraping function
async function scrape() {
  // Get configuration from user
  const config = await getConfig();
  NUM_TABS = config.numTabs;
  BROWSER_TYPE = config.browserType;
  WORKER_ID = config.workerId;
  ENABLE_SOUND = config.enableSound;
  CONFIG.WORKER_ID = WORKER_ID;

  // Load sounds if enabled
  if (ENABLE_SOUND) {
    try {
      const soundsModule = await import("./sounds.js");
      playNotification = soundsModule.playNotification;
    } catch (e) {
      console.warn(
        "Warning: Could not load sounds.js - sound will be disabled",
      );
      ENABLE_SOUND = false;
      console.warn(`Error: ${e.message}`);
    }
  }

  console.log(`QPub MySQL Scraper - Worker: ${CONFIG.WORKER_ID}\n`);

  // Check if currently in backup window or nighttime - sleep until it ends
  if (isBackupTime()) {
    console.log(
      `${colors.yellow}⏰ Backup window in progress (7:00 PM - 8:00 PM)${colors.reset}`,
    );
    console.log(
      `${colors.green}Waiting for backup to complete (${getTimeUntilBackup()})...${colors.reset}\n`,
    );
    await sleepUntilResume("backup");
  } else if (isNighttime()) {
    console.log(
      `${colors.yellow}🌙 Nighttime block in progress (11:00 PM - 5:00 AM)${colors.reset}`,
    );
    console.log(
      `${colors.green}Waiting until morning (${getTimeUntilMorning()})...${colors.reset}\n`,
    );
    await sleepUntilResume("nighttime");
  }

  console.log(`Configuration:`);
  console.log(`  Tabs: ${NUM_TABS}`);
  console.log(`  Browser: ${BROWSER_TYPE}`);
  console.log(`  Worker: ${CONFIG.WORKER_ID}`);
  console.log(`  Sound: ${ENABLE_SOUND ? "enabled" : "disabled"}\n`);

  // Check if NAS is mounted
  if (!existsSync(CONFIG.NAS_PATH)) {
    console.error("ERROR: NAS not mounted!");
    console.error(`Expected path: ${CONFIG.NAS_PATH}`);
    process.exit(1);
  }

  // Test MySQL connection
  try {
    await db.query("SELECT 1 as test");
    console.log("✓ MySQL connection successful\n");
  } catch (error) {
    console.error("ERROR: MySQL connection failed!");
    console.error(error.message);
    process.exit(1);
  }

  // Load initial queue stats
  console.log("Loading queue stats...\n");
  await updateQueueStats();

  // Select browser engine and apply stealth plugin
  browser = browserEngines[BROWSER_TYPE] || chromium;
  const stealth = StealthPlugin();
  stealth.enabledEvasions.delete("user-agent-override");
  browser.use(stealth);

  // Launch browser
  console.log(`Opening ${BROWSER_TYPE} browser...\n`);
  const randomViewport = getRandomViewport();

  // Browser launch args - extra args for Windows compatibility
  const launchArgs = [];
  if (process.platform === "win32") {
    launchArgs.push("--disable-dev-shm-usage"); // Helps with Windows memory issues
  }

  // Windows-specific: Use installed Chrome/Edge instead of bundled Chromium
  const launchOptions = {
    headless: false,
    args: launchArgs,
    timeout: 30000,
  };

  // On Windows, try to use system Chrome/Edge which is more stable
  if (process.platform === "win32" && BROWSER_TYPE === "chromium") {
    launchOptions.channel = "msedge"; // or 'chrome' if you have Chrome installed
    console.log(
      `${colors.dim}(Using Microsoft Edge on Windows for better compatibility)${colors.reset}\n`,
    );
  }

  try {
    browserInstance = await browser.launch(launchOptions);
    console.log(
      `${colors.green}✓ Browser launched successfully${colors.reset}\n`,
    );
  } catch (error) {
    // On Windows, if Edge channel failed, try Chrome
    if (
      process.platform === "win32" &&
      BROWSER_TYPE === "chromium" &&
      !error.message.includes("chrome")
    ) {
      console.log(
        `${colors.yellow}Edge failed, trying Chrome...${colors.reset}\n`,
      );
      try {
        launchOptions.channel = "chrome";
        browserInstance = await browser.launch(launchOptions);
        console.log(
          `${colors.green}✓ Browser launched successfully with Chrome${colors.reset}\n`,
        );
      } catch (error2) {
        console.error(
          `${colors.red}ERROR: Both Edge and Chrome failed to launch!${colors.reset}`,
        );
        console.error(`Error: ${error2.message}\n`);

        console.log(`${colors.yellow}Troubleshooting steps:${colors.reset}`);
        console.log(
          `  1. Install Playwright's bundled browser: npx playwright install chromium`,
        );
        console.log(`  2. Make sure Edge or Chrome is installed`);
        console.log(`  3. Try running as administrator (Windows)`);
        console.log(`  4. Try WSL instead of native Windows\n`);
        process.exit(1);
      }
    } else {
      console.error(
        `${colors.red}ERROR: Failed to launch browser!${colors.reset}`,
      );
      console.error(`Browser: ${BROWSER_TYPE}`);
      console.error(`Error: ${error.message}\n`);

      console.log(`${colors.yellow}Troubleshooting steps:${colors.reset}`);
      console.log(
        `  1. Install Playwright browsers: npx playwright install ${BROWSER_TYPE}`,
      );
      console.log(`  2. Try running as administrator (Windows)`);
      console.log(`  3. Check if antivirus/firewall is blocking Playwright`);
      console.log(
        `  4. Try a different browser when prompted (firefox or webkit)\n`,
      );
      process.exit(1);
    }
  }

  const context = await browserInstance.newContext({
    viewport: randomViewport,
  });

  console.log("Setting up tabs...\n");

  // Create all tabs and initialize state
  for (let i = 0; i < NUM_TABS; i++) {
    const page = await context.newPage();

    // Navigate to QPub homepage to establish session
    console.log(`Tab ${i + 1}: Loading QPub homepage...\n`);
    try {
      await page.goto(
        "https://qpublic.schneidercorp.com/Application.aspx?AppID=1045&LayerID=23342&PageTypeID=2&PageID=9744",
        {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        },
      );
      console.log(`Tab ${i + 1}: Ready\n`);
    } catch (error) {
      console.warn(
        `Tab ${i + 1}: Could not load homepage - ${error.message}\n`,
      );
    }

    tabStates.push({
      id: i + 1,
      page,
      status: "starting",
      scrapedCount: 0,
      failedCount: 0,
      logs: [],
      currentTMK: null,
      waitingSince: null,
      resolveWait: null,
    });

    // Stagger tab creation
    if (i < NUM_TABS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("All tabs ready! Starting to scrape...\n");

  // Setup input handler
  setupInputHandler();

  // Initial display
  setTimeout(() => displayStatus(), 2000);

  // Run all tabs in parallel
  const promises = tabStates.map((tab) => scrapeTab(tab.page, tab.id));

  // Wait for all tabs to complete
  const results = await Promise.all(promises);

  const totalScraped = results.reduce((sum, count) => sum + count, 0);
  const totalFailed = tabStates.reduce((sum, tab) => sum + tab.failedCount, 0);

  await browserInstance.close();

  clearScreen();

  console.log(`\n✅ All tabs completed!`);
  console.log(`   Total scraped: ${totalScraped} records`);
  console.log(`   Total failed: ${totalFailed} records\n`);
}

scrape().catch((error) => {
  console.error("\nERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
});
