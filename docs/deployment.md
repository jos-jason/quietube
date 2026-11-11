# Deploying the web app

Quietube is a single static page — upload the contents of `web-app/` to any static host. There is **no router**: deep links must use the root path with query params (`/?v=...`), not `/watch?v=...`.

## GitHub Pages (used by this repo)
This repo includes `.github/workflows/pages.yml`, which publishes the `web-app/` folder on every push to `main`.
1. Fork the repo, then go to **Settings → Pages** and set **Source: GitHub Actions**.
2. Push a change (or run the workflow manually from the **Actions** tab).
3. Your app will be at `https://<user>.github.io/<repo>/`. Set that same URL (including the `/<repo>` path) in the extension's Options page.

## Netlify / Cloudflare Pages / Vercel
Set the publish directory to `web-app`, no build command.

## After deploying
- Add the deployed origin to your API key's website restrictions.
- Set the same origin in the extension's Options page.
