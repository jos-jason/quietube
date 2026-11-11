# Getting a YouTube Data API v3 key

1. Go to https://console.cloud.google.com/ and create a new project (top project dropdown → **New Project**). After creating it, open the dropdown again and make sure the new project is **selected**.
2. Open **APIs & Services → Library**, search **YouTube Data API v3**, click **Enable**.
3. Open **APIs & Services → Credentials → Create credentials → API key**.
4. **Restrict the key** (strongly recommended, since it's used in the browser):
   - *Application restrictions*: **Websites**, add your domain(s), e.g. `https://yourname.github.io/*` and `http://localhost:8080/*`.
   - *API restrictions*: restrict to **YouTube Data API v3**.
5. Paste the key into Quietube's setup screen. It is stored only in your browser.

## Quota notes

The default quota is 10,000 units/day. A `search.list` call costs 100 units, so ~100 searches/day. `videos.list` / `channels.list` cost 1 unit. The matched-channel feature and "danger mode" (50 results) use more data per search but the same search cost.
