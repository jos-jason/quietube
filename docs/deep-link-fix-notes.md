# Quietube — Handoff: Fix + Republish to quietube.pplx.app

**Why you're reading this:** This work happened in a different session that doesn't have the `site_id` for the already-published `quietube.pplx.app` site. This session (the one where you originally ran `publish_website` with `subdomain: "quietube"`) does have that history, so it's the right place to apply the fix and republish.

## What was broken

A companion browser extension ("Quietube Redirector") intercepts YouTube navigation and sends the user to `quietube.pplx.app`. Two bugs surfaced when testing it against the real deployed app:

1. **Extension redirected to non-existent routes.** It was building URLs like `https://quietube.pplx.app/watch?v=...`, `/results?...`, `/playlist?...`. But `quietube.pplx.app` is a single static `index.html` app with no server-side router — those paths 404 with `"No static asset at /watch"`.
2. **The app had no deep-link support anyway.** Even after fixing the extension to redirect to the root path (`/?v=...`), `app.js` never read the URL's query string on load — it always just showed the search/setup screen, ignoring any `v=`, `t=`, or `search_query=` params.

## The fix (only `app.js` changed — `index.html`, `base.css`, `style.css` are untouched)

Add deep-link parsing that runs on load and after API-key setup, so a link like `https://quietube.pplx.app/?v=3Op1-uCZ3rw&t=147` auto-plays that exact video at the 2:27 mark, and `?search_query=...` runs a search automatically.

Apply this diff to your copy of `app.js`:

```diff
@@ -155,8 +155,7 @@
     state.apiKey = val;
     safeSet('qt_api_key', val);
     els.setupError.textContent = '';
-    showView('search');
-    els.searchInput.focus();
+    resolveInitialView();
   });
 
   els.forgetKeyBtn.addEventListener('click', function () {
@@ -882,7 +881,7 @@
     return ytApiPromise;
   }
 
-  function playVideo(videoId, title) {
+  function playVideo(videoId, title, startSeconds) {
     if (!videoId) return;
     state.playerReturnView = getVisibleView();
     showView('player');
@@ -895,18 +894,23 @@
     mount.id = 'yt-mount';
     els.playerContainer.appendChild(mount);
 
+    var playerVars = {
+      autoplay: 1,
+      rel: 0,
+      modestbranding: 1,
+      iv_load_policy: 3,
+      playsinline: 1,
+      fs: 1,
+      origin: window.location.origin,
+    };
+    if (startSeconds && startSeconds > 0) {
+      playerVars.start = startSeconds;
+    }
+
     loadYouTubeApi().then(function () {
       state.player = new YT.Player('yt-mount', {
         videoId: videoId,
-        playerVars: {
-          autoplay: 1,
-          rel: 0,
-          modestbranding: 1,
-          iv_load_policy: 3,
-          playsinline: 1,
-          fs: 1,
-          origin: window.location.origin,
-        },
+        playerVars: playerVars,
         events: {
           onStateChange: onPlayerStateChange,
         },
@@ -949,7 +953,47 @@
     showView(target);
   });
 
+  /* ---------- Deep links (from the Quietube Redirector browser extension) ----------
+     Supports:
+       ?v=VIDEO_ID&t=147            (from youtube.com/watch, timestamp in seconds)
+       ?v=VIDEO_ID&time_continue=147 (alternate timestamp param YouTube also uses)
+       ?search_query=some+query     (from youtube.com/results) */
+
+  function parseDeepLink() {
+    var params = new URLSearchParams(window.location.search);
+    var videoId = params.get('v');
+    var startRaw = params.get('t') || params.get('time_continue') || params.get('start');
+    var start = startRaw ? parseInt(startRaw, 10) : 0;
+    var query = params.get('search_query') || params.get('q');
+    return {
+      videoId: videoId || null,
+      start: isNaN(start) ? 0 : start,
+      query: query || null,
+    };
+  }
+
+  var deepLink = parseDeepLink();
+
+  function resolveInitialView() {
+    if (deepLink.videoId) {
+      playVideo(deepLink.videoId, '', deepLink.start);
+      return;
+    }
+    if (deepLink.query) {
+      showView('search');
+      els.searchInput.value = deepLink.query;
+      runSearch(deepLink.query);
+      return;
+    }
+    showView('search');
+    els.searchInput.focus();
+  }
+
   /* ---------- Init ---------- */
 
-  showView(hasKey() ? 'search' : 'setup');
+  if (hasKey()) {
+    resolveInitialView();
+  } else {
+    showView('setup');
+  }
 })();
```

## Companion extension fix (already done, FYI — no action needed here)

The extension's `background.js` (DNR rules) and `content.js` were updated in the other session to redirect everything to the root path with the params preserved — e.g. `https://quietube.pplx.app/?v=3Op1-uCZ3rw&t=147` instead of `/watch?v=...`. That fixed zip has already been shared with the user. This handoff is only about getting the matching `app.js` fix live on the server side.

## How to republish

1. Apply the diff above to the project's `app.js` (paths unchanged: `index.html`, `app.js`, `base.css`, `style.css`, `assets/favicon.svg`).
2. Redeploy the preview first (required before publish, same `dist_path` as the live project):
   ```
   deploy_website(
     project_path="<this project's path>",
     site_name="Quietube",
     entry_point="index.html"
   )
   ```
   Note: this app calls `localStorage` (wrapped in try/catch with an in-memory fallback) to persist the user's YouTube API key — the preview iframe blocks `localStorage`, so `deploy_website` may report "forbidden browser APIs detected." That's expected and safe here; call it with `should_validate=false` to bypass the iframe-only check. It works normally once published.
3. Publish using the known `site_id` for `quietube.pplx.app` (do NOT use the subdomain picker — pass `site_id` directly so it updates the existing site rather than trying to claim a new one):
   ```
   publish_website(
     project_path="<this project's path>",
     dist_path="<same path used above>",
     app_name="Quietube",
     site_id="<the known site_id for quietube.pplx.app>"
   )
   ```
   No `run_command`/`install_command` needed — this is a fully static app with no backend.
4. Confirm the fix by opening `https://quietube.pplx.app/?v=dQw4w9WgXcQ&t=10` after entering an API key — it should jump straight into the player at 0:10 instead of showing the search screen.

## Security note
A security review already ran on this app: no hardcoded secrets, no critical issues. One low-severity, non-blocking note — a few YouTube-API-sourced fields (video/channel/playlist IDs and thumbnail URLs) are inserted into HTML via `innerHTML` without the same `escapeHtml()` treatment given to titles. Low real-world risk since IDs/URLs come from YouTube's own API, but worth tightening for defense-in-depth if you're already in the file.
