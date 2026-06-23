# AGENTS.md — Personal Dashboard

## What this is
A single-user, **public** personal-tracking website. Pulls my life data into one retro/playful dashboard. **Automated data only** — no manual journaling.

## Stack
Next.js + TypeScript + Tailwind on Vercel. Neon Postgres for history. Prefer Vercel/serverless collection first when it can be done safely with private server-side env vars. A separate collector may run on my M1 Mac Mini later for data sources that should not be hosted, need local-only access, or need more reliable scheduled collection.

## What it tracks
- **42** — progress, level, project status, time on campus
- **Health** (Google Health API) — sleep, steps, heart rate, workouts
- **RescueTime** — screen time / focus
- **WakaTime** — coding time by language & project
- **GitHub** — commits, contribution graph
- **LeetCode** — solves, ranking
- **Todoist** — tasks completed, karma
- **Obsidian** (Gas24 vault) — notes & words created
- **Location** — coarse home-vs-42 patterns only

## Data freshness
- **Live** (fetched on load, cached): GitHub, WakaTime, LeetCode, Todoist, "am I at 42 right now"
- **Daily** (Vercel/serverless first if safe, collector → Neon later if needed): health, RescueTime, Obsidian, 42 history
- **Daily** (Mini-only unless explicitly changed): location

## v1
A "currently" hero line: at 42 / off-campus · today's logtime · coding now (project + language) · last commit. Ship this first, on its own.

## Aesthetic
Retro / playful. Pixel grids, contribution-style heatmaps, monospace, terminal/CRT hero. A reusable heatmap component is the visual centerpiece.

## Non-negotiables
- The site is **public** — treat every rendered value as world-readable.
- **Location**: only aggregates, lagged ~1 day. **Never a live "at home" status** (it signals an empty flat). "At 42" live is fine.
- **Sensitive tokens** are never exposed to the browser, logs, or `NEXT_PUBLIC_*` env vars.
- **Google Health OAuth credentials/tokens** may live in Vercel env vars for early MVP work only as private server-side variables, using the minimum read-only scopes needed. Treat client secret, refresh token, and access token as sensitive.
- **Full 42 and location tokens** live only on the Mini unless I explicitly approve moving them. Low-sensitivity read-only tokens (GitHub, WakaTime, Todoist) may be Vercel env vars.

## Ask me before
- Exposing any new location detail.
- Putting full 42, location, or any new high-sensitivity token on Vercel.
- Exposing Google Health data beyond coarse/daily dashboard values.
- Adding a hosted service or a manual-input feature (out of scope).
