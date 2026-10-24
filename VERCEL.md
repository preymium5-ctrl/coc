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

The included Vercel cron runs **every minute** for the Pro deployment at `clashofclans.dev`. Set `RAIDROOM_SYNC_INTERVAL_SECONDS=60` in Production. Rankings in an open browser refresh every 30 seconds; fresh activity still depends on the collection schedule and provider availability. For a Hobby deployment, change the cron schedule to `0 0 * * *` and the interval to `86400`.

For **one-minute collection on Hobby**, configure an external HTTP scheduler to make a GET request every minute to:

```text
https://YOUR-SITE.vercel.app/api/cron/activity
```

Set its HTTP header to `Authorization: Bearer YOUR_CRON_SECRET` and set `RAIDROOM_SYNC_INTERVAL_SECONDS=60` in Vercel, then redeploy. Keep the secret in the scheduler's private header settings, never the URL. Use a scheduler that permits a long enough request timeout for a full clan round. Deployment Protection must allow the scheduler to reach the production endpoint; the endpoint itself always verifies the secret.

For **Vercel Pro**, change the cron schedule in `vercel.json` to `* * * * *`, set `RAIDROOM_SYNC_INTERVAL_SECONDS=60`, and redeploy. [Vercel Hobby permits daily cron; Pro permits minute schedules](https://vercel.com/docs/cron-jobs/usage-and-pricing). Function usage and database/provider limits still apply.

The sync endpoint awaits all member batches before responding. Database leases prevent overlapping rounds; failed feeds retain saved data and are retried on later invocations. A missed external scheduler invocation cannot be recovered until a later invocation arrives. Collection is observational and cannot recover battles omitted by providers.

## Local verification

```sh
npm run check
npm run build:vercel
npm run start:vercel -- --port 3000
```

For a local Next.js smoke test, put hosted variables in the ignored `.env.local`. For a manual remote migration, put database variables in `.env.vercel.local` and run `npm run db:migrate:vercel`. The original `npm run dev`, `npm run build`, and `npm start` continue to use local Cloudflare D1 and the local background collector.
