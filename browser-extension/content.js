// content.js — runs on youtube.com / youtu.be / m.youtube.com
//
// declarativeNetRequest only ever sees real network requests. YouTube's
// front end is a single-page app: clicking a video thumbnail, submitting a
// search from the in-page search box, or paging through results usually
// happens via history.pushState()/replaceState() + fetch(), which never
// creates a new top-level navigation request. DNR is blind to that, so this
// content script re-implements the same URL mapping client-side and forces
// a real navigation whenever the SPA's URL bar state lands on a page we
// want redirected.

(function () {
  // Quietube is a single static index.html with no server-side routes, so
  // every mapping below lands on "/" and passes state purely via query
  // params (matching background.js's dynamic DNR rules exactly).
  const PATTERNS = [
    { re: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(.*)$/, build: (m, base) => `${base}/?${m[1]}` },
    { re: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/results\?(.*)$/, build: (m, base) => `${base}/?${m[1]}` },
    { re: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/playlist\?(.*)$/, build: (m, base) => `${base}/?${m[1]}` },
    {
      // Optional trailing slash after the ID, and any query string (t=,
      // si=, feature=share, ...) is forwarded through instead of dropped —
      // mirrors the youtu.be pattern below and background.js's DNR rules.
      re: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]+)\/?(?:\?(.*))?$/,
      build: (m, base) => `${base}/?v=${m[1]}${m[2] ? "&" + m[2] : ""}`
    },
    {
      re: /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]+)(?:\?(.*))?$/,
      build: (m, base) => `${base}/?v=${m[1]}${m[2] ? "&" + m[2] : ""}`
    }
  ];

  function isEmbed(url) {
    // Never touch YouTube's own embed player — Quietube likely still loads
    // it internally to actually play video.
    return /^https?:\/\/(?:www\.|m\.)?youtube\.com\/embed\//.test(url);
  }

  function resolveTarget(url, base) {
    if (isEmbed(url)) return null;
    for (const pattern of PATTERNS) {
      const match = url.match(pattern.re);
      if (match) return pattern.build(match, base);
    }
    return null;
  }

  let cachedConfig = null;
  async function getConfig() {
    if (cachedConfig) return cachedConfig;
    try {
      const response = await chrome.runtime.sendMessage({ type: "quietube:resolve" });
      cachedConfig = response?.config ?? null;
    } catch (err) {
      // Service worker may be asleep on first fire; fail safe (no redirect).
      cachedConfig = null;
    }
    return cachedConfig;
  }

  async function maybeRedirect(url) {
    const config = await getConfig();
    if (!config?.enabled) return;
    const base = config.quietubeOrigin.replace(/\/$/, "");
    const target = resolveTarget(url, base);
    if (target && target !== url) {
      window.location.replace(target);
    }
  }

  // Covers: extension installed/enabled while a YouTube tab was already
  // open, or any edge case where the network-level DNR redirect was
  // bypassed (e.g. back-forward cache restores).
  maybeRedirect(window.location.href);

  // Covers: client-side SPA navigations driven by the History API.
  ["pushState", "replaceState"].forEach((method) => {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      maybeRedirect(window.location.href);
      return result;
    };
  });
  window.addEventListener("popstate", () => maybeRedirect(window.location.href));
})();
