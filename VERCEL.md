# Publish Raidroom on Vercel

The repository supports both the original local Cloudflare runtime and native Next.js on Vercel. Vercel uses a **remote libSQL database** for shared clan settings, activity records, sync leases, and admin sessions. Your local `.wrangler` database is not uploaded.

## 1. Create storage and private credentials

Create a **libSQL** database in [Turso](https://docs.turso.tech/integrations/vercel), either through its dashboard or the Vercel Marketplace integration. Obtain the database URL and a read/write database auth token. Choose the libSQL engine for this adapter.

Run locally:

```sh
npm ci
npm run admin:setup:vercel
```

Open the generated private file `.openai/local/vercel-access.txt`. It contains your new admin password, its verifier, and a scheduler secret. This file is ignored by Git. The command preserves existing credentials when run again.

## 2. Import the GitHub repository

In Vercel choose **Add New → Project**, import **preymium5-ctrl/coc**, and use the repository root. `vercel.json` sets the Next.js framework, `npm ci`, `npm run build:vercel`, and `.next-vercel` output automatically. Use Node.js 22 or newer and enable Fluid Compute for the 300-second sync function.

Add these environment variables before deploying:

| Variable | Value |
| --- | --- |
| `COC_API_TOKEN` | Your Clash of Clans developer API key |
| `COC_API_BASE_URL` | `https://cocproxy.royaleapi.dev/v1` |
| `TURSO_DATABASE_URL` | Your remote `libsql://…` database URL |
| `TURSO_AUTH_TOKEN` | Your read/write libSQL database token |
| `RAIDROOM_ADMIN_PASSWORD_HASH` | The verifier in the private Vercel access note |
| `CRON_SECRET` | The scheduler secret in that note |

These are server variables; never prefix them with `NEXT_PUBLIC_`. For the default proxy, your Supercell developer key must allow IP `45.79.218.79`; see [RoyaleAPI's proxy instructions](https://docs.royaleapi.com/proxy.html). Vercel's outbound IP is not the proxy allowlist address.

The build applies SQL migrations transactionally and records their checksums. Repeated deployments skip applied migrations. No player records, local sessions, or API keys are seeded. A build without database credentials can complete, but the dashboard shows a storage-configuration message until you add the variables and redeploy. Use a separate database for Preview deployments, or keep production credentials restricted to Production.

After deployment, open **`https://YOUR-SITE.vercel.app/admin`**, sign in with the generated password, and enter **`#V822RGUG`** to publish **MARINE CLAN-21~**, Duck's clan. Every visitor then sees the same clan at `/`.

## 3. Choose the automatic sync schedule

The included Vercel Pro cron runs **once per hour**, at minute zero (`0 * * * *`). Production uses `RAIDROOM_SYNC_INTERVAL_SECONDS=3600`. Values below an hour are ignored, preventing an old minute setting from restoring frequent collection. Both clans are collected during the same invocation. Open dashboards refresh hourly, including admin player views; returning to a tab only refreshes when an hour is due.

Game profiles, battle feeds, wars, Capital raids, Games history, member details, and leaderboards share server caches that expire at the next hourly boundary. A completed collector run invalidates derived member and clan summaries. During a transient profile-feed outage, an existing real profile can be served with a saved-data notice; stale profile counters are never treated as new Clan Games observations. For a Hobby deployment, change the cron schedule to `0 0 * * *` and the interval to `86400`.

An external scheduler, if used, should make an hourly GET request to `/api/cron/activity` with `Authorization: Bearer YOUR_CRON_SECRET`. Keep the secret in the scheduler's private header settings and allow enough request time for a full clan round. The endpoint always verifies the secret. Do not add a second scheduler to a deployment already using Vercel cron.

### API rate limits

The `coc` project's published Vercel Firewall rules enforce **60 requests per minute per IP** for `/api/` excluding `/api/players/`, and **15 per minute per IP** for player profiles and battle feeds. Excess requests receive HTTP 429 at the firewall, before application execution. Static assets are outside these rules. Authenticated cron requests remain protected by their existing secret and make one request per hour.

The intended rules are recorded in `config/vercel-firewall-rules.json`; this file documents the policy and is not automatically applied by deployment. Inspect the live settings with `vercel firewall rules list --scope lambo3 --project coc`, review draft changes with `vercel firewall diff`, and publish intentional changes with `vercel firewall publish`. These are fixed-window counters per IP and Vercel region, so this is a traffic control rather than a hard spending cap. Normal Vercel Firewall pricing applies.

The sync endpoint awaits all member batches before responding. Database leases prevent overlapping rounds; failed feeds retain saved data and are retried on later invocations. A missed external scheduler invocation cannot be recovered until a later invocation arrives. Collection is observational and cannot recover battles omitted by providers.

## Local verification

```sh
npm run check
npm run build:vercel
npm run start:vercel -- --port 3000
```

For a local Next.js smoke test, put hosted variables in the ignored `.env.local`. For a manual remote migration, put database variables in `.env.vercel.local` and run `npm run db:migrate:vercel`. The original `npm run dev`, `npm run build`, and `npm start` continue to use local Cloudflare D1 and the local background collector.
