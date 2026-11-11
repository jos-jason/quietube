// background.js — Manifest V3 service worker
// Owns the declarativeNetRequest dynamic ruleset. Rules are generated in
// JS (not hard-coded JSON) so the Quietube target domain and toggles can be
// changed from the options page at runtime without shipping a new build.

const DEFAULT_CONFIG = {
  enabled: true,
  quietubeOrigin: "https://jos-jason.github.io/quietube",
  redirectHome: false // if true, also redirect youtube.com/ (home, channels, trending), not just watch/search
};

const RULE_ID = {
  ALLOW_EMBED: 1,
  WATCH: 2,
  SEARCH: 3,
  SHORT_WITH_QUERY: 4,
  SHORT_PLAIN: 5,
  SHORTS: 6,
  PLAYLIST: 7,
  HOME: 8,
  SHORTS_WITH_QUERY: 9
};

async function getConfig() {
  const stored = await chrome.storage.sync.get(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...stored };
}

function buildRules(config) {
  const target = config.quietubeOrigin.replace(/\/$/, "");
  const targetHost = new URL(target).host;
  // Supports hosting under a sub-path (e.g. GitHub Pages: /quietube/).
  const targetPath = new URL(target).pathname.replace(/\/?$/, "/");
  const rules = [];

  // --- Safety net --------------------------------------------------------
  // "allow" always outranks "redirect" in DNR's fixed action-precedence
  // order, regardless of numeric priority. This guarantees that if the
  // Quietube app itself embeds a real youtube.com/embed/<id> iframe to
  // actually play the video, that request is never caught in a redirect
  // loop by the rules below.
  rules.push({
    id: RULE_ID.ALLOW_EMBED,
    priority: 100,
    action: { type: "allow" },
    condition: {
      regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/embed/.*$",
      resourceTypes: ["main_frame", "sub_frame"]
    }
  });

  // --- Watch pages ---------------------------------------------------------
  // Quietube is a single static index.html with no server-side routes — it
  // reads everything from the query string on "/". So the transform swaps
  // scheme+host AND forces path to "/" (a request to /watch on a static
  // host with no SPA fallback 404s, which is exactly the "No static asset
  // at /watch" error). Query params (v, t, list, index, si, ...) are left
  // untouched — no manual param parsing needed.
  rules.push({
    id: RULE_ID.WATCH,
    priority: 10,
    action: { type: "redirect", redirect: { transform: { scheme: "https", host: targetHost, path: targetPath } } },
    condition: {
      regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/watch\\?.*$",
      resourceTypes: ["main_frame"]
    }
  });

  // --- Search results (preserves search_query, sp filters, etc.) ---------
  rules.push({
    id: RULE_ID.SEARCH,
    priority: 10,
    action: { type: "redirect", redirect: { transform: { scheme: "https", host: targetHost, path: targetPath } } },
    condition: {
      regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/results\\?.*$",
      resourceTypes: ["main_frame"]
    }
  });

  // --- Playlist pages ------------------------------------------------------
  // Note: Quietube doesn't currently deep-link into a specific playlist —
  // this still routes to "/" instead of erroring so the user at least
  // lands on the app instead of a broken static-asset page.
  rules.push({
    id: RULE_ID.PLAYLIST,
    priority: 10,
    action: { type: "redirect", redirect: { transform: { scheme: "https", host: targetHost, path: targetPath } } },
    condition: {
      regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/playlist\\?.*$",
      resourceTypes: ["main_frame"]
    }
  });

  // --- Shorts --------------------------------------------------------------
  // Two rules, same pattern used for youtu.be short links below: a
  // higher-priority "with query" rule forwards t=/si=/etc. through to
  // Quietube's own deep-link parser, and a lower-priority "plain" rule
  // covers bare /shorts/<id> links with no query string. Both tolerate an
  // optional trailing slash after the video ID (e.g. "/shorts/<id>/"),
  // which the previous single-rule version missed.
  rules.push({
    id: RULE_ID.SHORTS_WITH_QUERY,
    priority: 11,
    action: { type: "redirect", redirect: { regexSubstitution: `${target}/?v=\\2&\\3` } },
    condition: {
      regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/shorts/([A-Za-z0-9_-]+)/?\\?(.+)$",
      resourceTypes: ["main_frame"]
    }
  });
  rules.push({
    id: RULE_ID.SHORTS,
    priority: 10,
    action: { type: "redirect", redirect: { regexSubstitution: `${target}/?v=\\2` } },
    condition: {
      regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/shorts/([A-Za-z0-9_-]+)/?$",
      resourceTypes: ["main_frame"]
    }
  });

  // --- youtu.be short links, WITH a query string (?t=, ?si=, ?list=) ------
  // Must have higher priority than the plain rule below so it wins whenever
  // a query string is present.
  rules.push({
    id: RULE_ID.SHORT_WITH_QUERY,
    priority: 11,
    action: { type: "redirect", redirect: { regexSubstitution: `${target}/?v=\\1&\\2` } },
    condition: {
      regexFilter: "^https?://youtu\\.be/([A-Za-z0-9_-]+)\\?(.+)$",
      resourceTypes: ["main_frame"]
    }
  });

  // --- youtu.be short links, no query string ------------------------------
  rules.push({
    id: RULE_ID.SHORT_PLAIN,
    priority: 10,
    action: { type: "redirect", redirect: { regexSubstitution: `${target}/?v=\\1` } },
    condition: {
      regexFilter: "^https?://youtu\\.be/([A-Za-z0-9_-]+)/?$",
      resourceTypes: ["main_frame"]
    }
  });

  // --- Optional: everything else on youtube.com (home, channels, trending) -
  if (config.redirectHome) {
    rules.push({
      id: RULE_ID.HOME,
      priority: 1,
      action: { type: "redirect", redirect: { transform: { scheme: "https", host: targetHost, path: targetPath } } },
      condition: {
        regexFilter: "^https?://(www\\.|m\\.)?youtube\\.com/.*$",
        resourceTypes: ["main_frame"]
      }
    });
  }

  return rules;
}

async function applyRules() {
  const config = await getConfig();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const addRules = config.enabled ? buildRules(config) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  await chrome.action.setBadgeText({ text: config.enabled ? "" : "off" });
}

// --- Event listeners required for URL filtering to stay correct ----------
chrome.runtime.onInstalled.addListener(applyRules);
chrome.runtime.onStartup.addListener(applyRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") applyRules();
});

// Lets the content script (running inside youtube.com pages) ask for the
// current config so it can replicate the same redirect logic for
// client-side / History-API navigations that never hit the network layer.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "quietube:resolve") return false;
  getConfig().then((config) => sendResponse({ config }));
  return true; // keep the message channel open for the async response
});

// Optional diagnostic channel — only useful while "declarativeNetRequestFeedback"
// is present in the manifest during development. Remove before store submission.
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.debug("[Quietube] rule matched:", info);
  });
}
