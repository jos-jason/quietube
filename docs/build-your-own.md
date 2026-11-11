# Building your own Quietube

## Design principles
Quietube exists to remove the "attention machinery" from YouTube while keeping the useful parts:
1. **Intentional entry** — you start from a search box, never a feed.
2. **Finite choices** — a small capped list instead of infinite scroll.
3. **One thing at a time** — the player shows one video; when it ends, it stops.
4. **User-owned** — your API key, your host, your settings, no server.

## Architecture

```
Browser
 ├─ index.html        views: setup · search · results · player · settings
 ├─ app.js            state, storage wrapper, API calls, rendering, player
 │    ├─ YouTube Data API v3 (search.list, videos.list, channels.list) via fetch
 │    └─ YouTube IFrame Player API (loaded on demand)
 └─ style.css/base.css  theming via CSS variables (light/dark)

Extension (optional)
 ├─ background.js     builds declarativeNetRequest redirect rules from options
 └─ content.js        catches YouTube's in-page (SPA) navigations and redirects
```

### Key pieces of `app.js`
- **Safe storage wrapper** (`safeGet/safeSet`) — falls back to memory if localStorage is blocked (e.g. sandboxed iframes). Keys are prefixed `qt_`.
- **State object** — `apiKey`, `resultCount`, `namesOnly`, `showChannels`, `dangerMode`, theme.
- **Search** — calls `search.list` with `maxResults = resultCount` (or 50 in danger mode).
- **Matched channel** — fetches a wider set and checks for near-exact channel title matches, showing a colored chip.
- **`playVideo(id, title, startSeconds)`** — mounts the IFrame player with `rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1` and optional `start`.
- **`resolveInitialView()`** — on load / after key entry, reads `v`, `t`, `search_query` from the URL to support deep links. See `docs/deep-link-fix-notes.md`.

## Customization ideas
- Change the default result count or remove the danger-mode toggle entirely.
- Add a daily watch-time or video-count limit stored in localStorage.
- Add an allowlist of channels (block search results from others).
- Hide thumbnails by default ("names only") to reduce clickbait pull.
- Swap the API call for a proxy server if you want to hide the key (then add auth).

## Extension tips
- Set your deployed origin in the Options page (default in code: `https://jos-jason.github.io/quietube` — change `DEFAULT_CONFIG.quietubeOrigin` in `background.js` for your fork).
- Redirects map `youtube.com/watch?v=X&t=Y`, `youtu.be/X`, and `/results?search_query=Q` to `<origin>/?v=X&t=Y` / `?search_query=Q`.
- `rules_static_example.json` shows a simpler static-ruleset alternative.

## Limitations
- Embedded playback is blocked for some videos by their owners.
- The API key is visible to anyone using your deployment — always restrict it by referrer.
- Shorts, comments, and subscriptions are intentionally not implemented.
