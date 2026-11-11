# Quietube

**Live app:** https://jos-jason.github.io/quietube/

A calm, distraction-free way to watch YouTube. Quietube is a small, fully client-side web app that searches YouTube with **your own API key**, shows only a handful of results (default 5), and plays one video at a time with no autoplay chains, related-video walls, or infinite scroll.

A companion Chrome/Brave extension (Manifest V3) can redirect every YouTube link you open to your Quietube instance automatically.

## Repository layout

```
web-app/            Static site (index.html, app.js, style.css, base.css, assets/)
browser-extension/  "Quietube Redirector" MV3 extension
docs/               Setup guides and design notes
```

## Features

- Capped results (adjustable count), optional "names only" and channel display modes
- Matched-channel chip: widens the fetch to flag near-exact channel-name matches
- Single-video player via the YouTube IFrame API (`rel=0`, no autoplay of next video)
- Deep links: `/?v=VIDEO_ID&t=147` plays at 2:27; `/?search_query=...` runs a search
- Light/dark theme; all settings and the API key stay in your browser's localStorage
- No backend, no build step, no tracking

## Quick start

1. Get a YouTube Data API v3 key — see [docs/youtube-api-key.md](docs/youtube-api-key.md).
2. Serve the web app locally:
   ```bash
   cd web-app
   python3 -m http.server 8080
   ```
   Open http://localhost:8080 and paste your key.
3. Deploy it anywhere static (see [docs/deployment.md](docs/deployment.md)).
4. Optionally install the extension and point it at your deployment — see [browser-extension/README.md](browser-extension/README.md).

## Build your own version

See [docs/build-your-own.md](docs/build-your-own.md) for architecture, customization points, and design principles.

## License

MIT — see [LICENSE](LICENSE).
