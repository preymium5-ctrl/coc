# Raidroom

A Clash of Clans dashboard in white, black, and blue with authentic game artwork, automatic player lookup, a battle journal, rankings, and a recording library.

## Run locally

Requires Node.js 22.13 or newer. Install with the Sites dependency helper, then run `npm run dev` and open the printed local URL. `npm run check` runs type checks and API contract tests. `npm run build` creates the Worker build.

Copy `.env.example` to `.env`. Create a free developer key at <https://developer.clashofclans.com>, allowing IP `45.79.218.79` for the RoyaleAPI proxy. Put the key in `COC_API_TOKEN`; the default server base is `https://cocproxy.royaleapi.dev/v1`. The proxy setup is documented at <https://docs.royaleapi.com/proxy.html>. Keep `.env` private and untracked. Hosted deployments use native Sites environment variables, with `COC_API_TOKEN` marked secret.

## Automatic data

Entering a player tag fetches the public Supercell profile through the Site's server. Raidroom detects the name, experience level, Town Hall, trophies, league, clan, troop levels, spell levels, heroes, and equipment. Refresh reloads the profile and activity; an open tab refreshes every five minutes.

Recent battle results and league groups come from the official API. ClashKing supplements recorded history and global/country rankings. Each result identifies its source. Missing values remain unknown, and provider outages show coverage messages without replacing real records with samples. No complete historical feed is guaranteed; older battles depend on provider coverage and records retained in this browser.

The Ranked battles page lists reported ranked and Legend attacks/defenses, current group placement where available, and reported season history. A null ranking means the player is not listed; unavailable rankings are labeled separately. Personal daily/weekly/all-time loot rankings use reported gold and elixir from attacks in this browser, not a global loot leaderboard.

API credentials stay server-side. Only the official API/proxy receives the Bearer token; community endpoints receive no token. Requests validate tags, time out, bound response size, reject redirects, and return sanitized errors. Public game data does not require a Supercell ID or game password.

## Browser records and recordings

Personal journals, trophy snapshots, and fetched battles use localStorage. Uploaded videos use IndexedDB; saved YouTube recordings can also play in the website. Playable in-game replays are not returned as video by the API. Export a JSON backup before clearing browser data or switching devices; video files need separate backups. Starting another village offers an export before replacing the current journal.

The initial sample village is clearly labeled. Connecting a real player clears sample records. Manual logging and official profile JSON import remain available.

## Structure and deployment

`ui/index.html` is served by `app/route.ts`. Browser assets and scripts live in `public/`. Server endpoints under `app/api/` use `lib/coc-service.mjs`. The Vinext/Cloudflare Worker build preserves the Sites hosting integration. `.openai/hosting.json` retains the existing project identity and private audience.

Game imagery is credited in the website footer. Collected history and rankings are provided by [ClashKing](https://clashk.ing/). This independent fan site is not endorsed by Supercell; see [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/).
