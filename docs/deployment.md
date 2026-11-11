# Deploying the web app

Quietube is a single static page — upload the contents of `web-app/` to any static host. There is **no router**: deep links must use the root path with query params (`/?v=...`), not `/watch?v=...`.

## GitHub Pages
1. Repo **Settings → Pages**. Source: **GitHub Actions**, or deploy from a branch with the `/web-app` folder copied to `/docs` or root.
2. Simplest: create a `gh-pages` branch containing only the `web-app/` files.
3. Your app will be at `https://<user>.github.io/<repo>/`.

## Netlify / Cloudflare Pages / Vercel
Set the publish directory to `web-app`, no build command.

## After deploying
- Add the deployed origin to your API key's website restrictions.
- Set the same origin in the extension's Options page.
