# PersoDashboard

A single-user, public personal-tracking website. Pulls my life data into one retro/playful dashboard.

## Google Health proof route

The MVP route is `GET /api/health/proof?date=YYYY-MM-DD`. It is server-only and requires:

```sh
DATABASE_URL=
GOOGLE_HEALTH_CLIENT_ID=
GOOGLE_HEALTH_CLIENT_SECRET=
GOOGLE_HEALTH_REFRESH_TOKEN=
GOOGLE_HEALTH_TIME_ZONE=Europe/Paris
HEALTH_PROOF_ADMIN_TOKEN=
CRON_SECRET=
```

Call it with:

```sh
curl -H "Authorization: Bearer $HEALTH_PROOF_ADMIN_TOKEN" \
  "https://your-vercel-domain.example/api/health/proof?date=2026-06-22"
```

Never prefix these variables with `NEXT_PUBLIC_`.

## Daily health sync

Vercel Cron calls `GET /api/health/cron` every two hours. The route:

- verifies `Authorization: Bearer $CRON_SECRET`
- fetches yesterday and today in `GOOGLE_HEALTH_TIME_ZONE`
- creates `health_daily` in Postgres if needed
- upserts sanitized daily aggregates only

Manual backfill:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-vercel-domain.example/api/health/cron?date=2026-06-22"
```

Simpler local commands:

```sh
npm run health:sync -- 2026-06-22
npm run health:sync:today
npm run health:backfill -- 2026-05-05 2026-06-23
```

The public homepage reads the latest stored rows from Neon. It never calls Google Health from the browser.
