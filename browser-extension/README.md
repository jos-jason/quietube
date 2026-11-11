# Quietube Redirector — dev packaging & testing guide

## 1. Configure your target
Edit the default in `background.js` (`DEFAULT_CONFIG.quietubeOrigin`) or just set it
from the extension's Options page after loading it — it's stored in `chrome.storage.sync`
and dynamic rules are rebuilt automatically on change.

## 2. Load in development mode (Chrome or Brave)
1. Open `chrome://extensions` (Brave: `brave://extensions`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder.
4. Open the extension's **Details → Inspect views → service worker** to see background
   console logs, and check **Errors** for manifest/permission issues.

Chrome will assign a random extension ID each reload unless you pin one with a `"key"`
field in `manifest.json` (generate via `chrome://extensions` → pack once, then copy the
generated `.pem`-derived key) — useful if your Quietube backend needs a stable
`chrome-extension://<id>` for CORS allow-listing.

## 3. Manual test matrix
| Scenario | Expected result |
|---|---|
| Type `youtube.com/watch?v=dQw4w9WgXcQ&t=42` in address bar | Lands on `https://quietube.pplx.app/?v=dQw4w9WgXcQ&t=42` (Quietube is a static SPA with no server routes, so everything redirects to `/` and Quietube reads state from the query string) |
| Click a `youtu.be/<id>?t=30` link from another site | Redirects preserving `t=30` |
| Type a query in YouTube's own search box while already on the redirected app (open a raw youtube.com tab manually to test) | SPA `pushState` navigation is caught by `content.js` and forced through `location.replace` |
| Click a `/shorts/<id>` link (with or without a trailing slash) | Redirects to `/?v=<id>` |
| Click a `/shorts/<id>?t=5` or `/shorts/<id>/?si=...` link | Redirects preserving the query string (`/?v=<id>&t=5`, etc.) |
| Swipe to the next Short inside YouTube's own Shorts feed (client-side navigation) | `content.js`'s pushState/replaceState hook catches the URL change and redirects |
| Site embedding `<iframe src="youtube.com/embed/<id>">` | **Not** redirected (allow-rule safety net) |
| Toggle "Enabled" off in the popup | All redirects stop immediately, no reload required |
| Change the Quietube URL in Options | Dynamic rules rebuild within the same tick (`storage.onChanged`) |

## 4. Debugging rule matches
With `declarativeNetRequestFeedback` in `manifest.json` (dev only — remove before store
submission, since it's a sensitive permission reviewers scrutinize):

```js
chrome.declarativeNetRequest.getMatchedRules({}, console.log);
```

Or watch `chrome.declarativeNetRequest.onRuleMatchedDebug` in the service worker console
(already wired up in `background.js`).

You can also dry-run a URL without navigating anywhere:
```js
chrome.declarativeNetRequest.testMatchOutcome(
  { url: "https://www.youtube.com/watch?v=abc123", type: "main_frame" },
  console.log
);
```

## 5. Packaging for distribution
- **Zip for Chrome Web Store / Brave sideload:** zip the folder contents (not the folder
  itself) — `manifest.json` must be at the zip root.
- **Chrome Web Store submission:** upload the zip in the Developer Dashboard, fill in the
  single-purpose description, and justify `host_permissions` in the review notes (scoped
  to youtube.com/youtu.be only — avoid `<all_urls>`, it triggers extra review scrutiny and
  a broader install-time warning).
- **Brave:** Brave uses the same Chromium extension format and can install straight from
  the Chrome Web Store, or sideload the same unpacked folder / zip via
  `brave://extensions`.
- Before submission, remove `declarativeNetRequestFeedback` from `permissions` if you added
  it for debugging — it's flagged as sensitive and unnecessary in production.

## 6. Cross-domain permission notes
- `host_permissions` only needs to cover the **source** domains you intercept
  (`youtube.com`, `youtu.be`, `m.youtube.com`). The **destination** (your Quietube origin)
  does not need to be listed — DNR's host-permission check applies to the request being
  redirected, not the redirect target.
- Do not add your Quietube domain to `host_permissions` unless you also want a content
  script or other API access running there.
- If you later want users to grant access to arbitrary sites at runtime instead of a fixed
  list, request permissions as `optional_host_permissions` and call
  `chrome.permissions.request()` from the options page rather than hardcoding everything
  at install time — this avoids Chrome Web Store's stricter review tier for broad
  install-time host permissions.
