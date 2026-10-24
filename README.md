# Raidroom

A Clash of Clans dashboard in white, black, and blue with authentic game artwork, automatic player lookup, a battle journal, a clan hub, rankings, and a recording library.

## Publish on Vercel

Import this repository in Vercel and follow [VERCEL.md](./VERCEL.md) to configure the API key, durable libSQL storage, admin password, and activity scheduler. The Vercel build is `npm run build:vercel`; local Cloudflare commands below remain available. Secrets and local activity data are excluded from Git.

## Run locally

Requires Node.js 22.13 or newer. Run `npm ci`, then `npm run dev` and open the printed local URL. `npm run check` runs type checks and API contract tests. `npm run build` creates the Worker build.

Copy `.env.example` to `.env`. Create a free developer key at <https://developer.clashofclans.com>, allowing IP `45.79.218.79` for the RoyaleAPI proxy. Put the key in `COC_API_TOKEN`; the default server base is `https://cocproxy.royaleapi.dev/v1`. The proxy setup is documented at <https://docs.royaleapi.com/proxy.html>. Keep `.env` private and untracked. Hosted deployments use native Sites environment variables, with `COC_API_TOKEN` marked secret.

## Admin and public views

`/` is the visitor dashboard: Overview, Members, Clan rankings, and Current war. It reads one clan selected in server-side settings, so every browser sees the same choice. Visitors can filter ranking periods and inspect published clan/war members. The server rejects anonymous settings changes and activity syncs, and rejects direct reads of other clans or players outside the published clan/war roster.

`/admin` is the management workspace. In **Overview**, enter the clan tag and choose **Create clan**; Supercell supplies the name and badge. **Save clan** replaces the public selection. **Unpublish clan** hides it while preserving collected activity. The time zone saved with the clan is shared by all visitor views.

For local development, `npm run admin:setup` generates a strong administrator password and stores a verifier in the ignored `.env`. The password is available only in the private local note `.openai/local/admin-access.txt`. It never appears in the public app or source control. Sign in at `/admin`; HttpOnly, SameSite cookies expire after eight hours, sessions are stored as hashes, login attempts are limited, and writes check the request origin. The Vite file server blocks the private access-note and runtime-data directories. Restart the dev server after first-time setup if it has not restarted automatically.

Hosted Sites keep the native Sign in with ChatGPT integration. Before a future deployment, set `RAIDROOM_AUTH_HOST` to the exact deployed hostname and `RAIDROOM_ADMIN_USER_IDS` to the comma-separated stable Sites user IDs allowed to administer it. All other users remain visitors; an empty allowlist grants no admin access. Local password login is enabled only for loopback hosts and the local environment flag; do not deploy its local verifier. This local task does not change the hosted Site's audience or publish a new deployment.

## Clan hub

An administrator adds the shared clan from **Overview** at `/admin`. Visitors open `/` and see only that published clan. The public pages have no clan/player switcher or editing tools. The roster shows names, Town Halls, player levels, and recorded activity. Select a member for hero, troop, spell, and pet levels; daily, weekly, and monthly loot and attack totals; army usage; and recorded CWL season averages. The current-war tab shows the real opponent, score, destruction, and war roster when the war log is public.

Clan leaderboards rank the current roster by reported gold + elixir or attacks made. Dark elixir is separate in member profiles. Periods use the clan's saved time zone: calendar days, weeks beginning Monday, and calendar months. Defenses are excluded. Repeated syncs upsert the same battle instead of counting it again. Saved public battle observations live in the local D1 database under `.wrangler/state`, independently of browser journals; retain that directory to keep the history.

A local server-owned collector automatically starts with `npm run dev` or `npm start`. It runs a clan-wide activity round once a minute, in two concurrent batches of at most two members each. It continues when admin pages and browser tabs are closed. The computer and local server must remain running. Public rankings and open member details refresh every 30 seconds; returning to a visible tab refreshes immediately. **Sync now** queues a round without overlapping an active one.

The collector reads the currently published clan from the database each round; it never uses a browser's stored selection or session. It collects the available current-month/current-week history. A database lease prevents duplicate workers, progress acknowledgements are idempotent, and interrupted rounds recover automatically after their lease expires. Unavailable member feeds are marked for automatic retry while their saved records remain intact. The dashboard shows collector connectivity, member progress, and last-sync time.

The local collector uses a generated `RAIDROOM_ACTIVITY_SYNC_KEY` in the ignored `.env` and a loopback-only service endpoint. It cannot change site settings, and public visitors cannot invoke it. It exits when its parent server stops. No Codex chat or scheduled ChatGPT automation is needed. Hosted unattended collection would require a separately configured supported scheduler; this local change does not deploy or schedule anything on the hosted Site. Provider coverage varies: counts and loot are recorded totals, not guaranteed complete history. A zero means no recorded attacks in the window; unknown loot remains blank. Members who leave the clan no longer appear in its current-roster ranking.

Troop usage counts the reported attacking armies containing a troop, grouped into classic (farming/ranked/Legend) and war (regular war/CWL). Only decodable army share codes contribute; unlocked troops are never used as a substitute. The usage sample is limited to the latest 3,000 saved records, while loot totals aggregate all saved records. War compositions often are not supplied. CWL averages divide valid recorded stars by attacks made and show missed attacks separately.

Hero, troop, spell, and pet denominators use Town Hall-specific maxima from the bundled ClashKing game catalogue. Builder Base units use Builder Hall. Twelve authentic pet icons are stored locally. Run `npm run data:sync` to update the catalogue and pet assets from [ClashKingAssets](https://github.com/ClashKingInc/ClashKingAssets); inspect the resulting game data before committing it.

### Fresh local database setup

The current workspace is already migrated. For a fresh checkout, run `npm run build`, then apply each pending SQL migration once using the matching generated Worker config:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tiny_shriek.sql
```

Then apply `drizzle/0001_tough_power_pack.sql` and `drizzle/0002_slippery_blade.sql` in order using the same command with each filename. Do not replay an applied migration. Later schema changes belong in new generated migrations. Local development and the built local Worker share `.wrangler/state`; hosted storage is separate.

## Automatic data

Entering a player tag fetches the public Supercell profile through the Site's server. Raidroom detects the name, experience level, Town Hall, trophies, league, clan, troop levels, spell levels, heroes, and equipment. Refresh reloads the profile and activity; an open tab refreshes every five minutes.

Recent battle results and league groups come from the official API. ClashKing supplements recorded history and global/country rankings. Each result identifies its source. Missing values remain unknown, and provider outages show coverage messages without fabricating records. No complete historical feed is guaranteed; older battles depend on provider coverage and records retained in this browser.

The Ranked battles page lists reported ranked and Legend attacks/defenses, current group placement where available, and reported season history. A null ranking means the player is not listed; unavailable rankings are labeled separately. Personal daily/weekly/all-time loot rankings use reported gold and elixir from attacks in this browser, not a global loot leaderboard.

API credentials stay server-side. Only the official API/proxy receives the Bearer token; community endpoints receive no token. Requests validate tags, time out, bound response size, reject redirects, and return sanitized errors. Public game data does not require a Supercell ID or game password.

## Browser records and recordings

Personal journals, trophy snapshots, and fetched battles use localStorage. Uploaded videos use IndexedDB; saved YouTube recordings can also play in the website. Playable in-game replays are not returned as video by the API. Export a JSON backup before clearing browser data or switching devices; video files need separate backups. Starting another village offers an export before replacing the current journal.

New visitors start with no player or battle records. Existing sample villages and marked sample battles are removed automatically from browser storage; genuine records and personal recordings are preserved. Manual logging and official profile JSON import remain available.

## Structure and deployment

`ui/index.html` is served by `app/route.ts`. Browser assets and scripts live in `public/`. Server endpoints under `app/api/` use `lib/coc-service.mjs`. The Vinext/Cloudflare Worker build preserves the Sites hosting integration. `.openai/hosting.json` retains the existing project identity and private audience.

Game imagery is credited in the website footer. Collected history and rankings are provided by [ClashKing](https://clashk.ing/). This independent fan site is not endorsed by Supercell; see [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/).
