// QPub Scraper — Content Script
// Runs on every qpublic.schneidercorp.com page at document_idle.
// Analyzes the page for blockers/captchas/success and reports to the service worker.

(function () {
  "use strict";

  // ─── Blocker Detection (mirrors scrape.ts checkForBlockers) ──────────

  function detectBlockers() {
    const title = document.title || "";

    // Cloudflare challenge page
    if (title.includes("Just a moment")) {
      return { blocked: true, type: "cloudflare_challenge" };
    }

    // QPub captcha / reCAPTCHA
    if (document.querySelector(".g-recaptcha")) {
      return { blocked: true, type: "qpub_captcha" };
    }
    if (document.querySelector("a#btnSubmit")) {
      return { blocked: true, type: "qpub_captcha" };
    }

    return { blocked: false };
  }

  // ─── Page Status (mirrors scrape.ts checkPageStatus) ─────────────────

  function getPageStatus() {
    const html = document.documentElement.outerHTML;
    const title = document.title || "";

    // Cloudflare block
    if (
      html.includes("Sorry, you have been blocked") ||
      html.includes("Cloudflare Ray ID")
    ) {
      return { status: "blocked", html: null };
    }

    if (title.includes("Just a moment")) {
      return { status: "blocked", html: null };
    }

    // A valid parcel profile page has "qPublic" and "Report:" in the title
    if (title.includes("qPublic") && title.includes("Report:")) {
      return { status: "success", html };
    }

    // Fallback: check for Parcel Number table row
    const parcelRowPattern =
      /<tr[^>]*>[\s\S]*?<th[^>]*>[\s\S]*?Parcel Number[\s\S]*?<\/th>[\s\S]*?<td[^>]*>[\s\S]*?\d+[\s\S]*?<\/td>[\s\S]*?<\/tr>/;
    if (parcelRowPattern.test(html)) {
      return { status: "success", html };
    }

    // Unknown / no data — still include HTML for debugging
    return { status: "unknown", html };
  }

  // ─── Keep service worker alive via port connection ───────────────────

  let port = null;

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: "qpub-content" });
      port.onDisconnect.addListener(() => {
        port = null;
        // Reconnect after a short delay if extension is still active
        setTimeout(connectPort, 1000);
      });
    } catch {
      // Extension context invalidated — stop trying
    }
  }

  connectPort();

  // ─── Analyze and report ──────────────────────────────────────────────

  function analyzeAndReport() {
    const blockers = detectBlockers();

    if (blockers.blocked) {
      chrome.runtime.sendMessage({
        type: "page-status",
        status: blockers.type === "qpub_captcha" ? "captcha" : "blocked",
        error: blockers.type,
        url: location.href,
      });

      // If captcha, poll for resolution
      if (blockers.type === "qpub_captcha") {
        startCaptchaPoll();
      }
      return;
    }

    const pageResult = getPageStatus();

    if (pageResult.status === "success" && pageResult.html) {
      chrome.runtime.sendMessage({
        type: "page-status",
        status: "success",
        html: pageResult.html,
        url: location.href,
      });
      return;
    }

    if (pageResult.status === "blocked") {
      chrome.runtime.sendMessage({
        type: "page-status",
        status: "blocked",
        error: "cloudflare_block",
        url: location.href,
      });
      return;
    }

    // Unknown / no data — still send HTML for debugging download
    chrome.runtime.sendMessage({
      type: "page-status",
      status: "unknown",
      html: pageResult.html,
      url: location.href,
    });
  }

  // ─── Captcha polling ─────────────────────────────────────────────────

  let captchaPollTimer = null;

  function startCaptchaPoll() {
    if (captchaPollTimer) return;

    captchaPollTimer = setInterval(() => {
      const blockers = detectBlockers();
      if (blockers.blocked) return; // Still blocked

      const pageResult = getPageStatus();
      if (pageResult.status === "success" && pageResult.html) {
        clearInterval(captchaPollTimer);
        captchaPollTimer = null;
        chrome.runtime.sendMessage({
          type: "page-status",
          status: "captcha-resolved",
          html: pageResult.html,
          url: location.href,
        });
      }
    }, 3000);
  }

  // ─── Run on load ─────────────────────────────────────────────────────

  analyzeAndReport();
})();
