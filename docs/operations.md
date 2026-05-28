# Operations Runbook

Production operations for Local Service Finder. Replace `<app>` with the Heroku
app name and `<region>`/origins with your real values.

---

## 1. Release pipeline & database migrations

**Status: verified.** [`backend/Procfile`](../backend/Procfile) runs migrations in
the release phase, before the new dynos start serving traffic:

```
web: npm run start:prod
release: npm run prisma:migrate:prod   # = prisma migrate deploy
```

`prisma migrate deploy` applies committed migrations from
`backend/prisma/migrations/` — it does **not** use `db push` and never alters the
schema implicitly, so it is safe for production.

### Gotcha fixed: `prisma` CLI must be a runtime dependency

Heroku prunes `devDependencies` after the build. The release phase then runs on
the pruned slug, so the `prisma` CLI must live in `dependencies` (not
`devDependencies`) or `prisma migrate deploy` fails with "command not found".
This was moved into `dependencies` in `backend/package.json`. **Do not move it
back.**

### One-time Heroku setup (dashboard / CLI)

```bash
# Tag Sentry releases with the deployed commit SHA (sets HEROKU_SLUG_COMMIT).
heroku labs:enable runtime-dyno-metadata -a <app>
```

### Verifying a release ran migrations

```bash
heroku releases -a <app>            # look for the "Deploy ... (release command)" entry
heroku releases:output <version> -a <app>   # shows the migrate deploy log
heroku pg:psql -a <app> -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

If the release command fails, the new release is **not** promoted and the old
dynos keep running — so a failed migration cannot take the site down, but it
does block the deploy until fixed.

---

## 2. Database backups & restore (Heroku Postgres)

### Continuous Protection (Point-in-Time Recovery)

Continuous Protection (WAL-based PITR) is **automatic on Standard-tier and above**
(`standard-*`, `premium-*`, etc.). It is **not** available on
`essential-*`/mini/hobby plans — those only support manual logical backups.

**Action (verify in dashboard):** confirm the production plan tier.

```bash
heroku pg:info -a <app>     # look at "Plan" and "Continuous Protection: On"
```

- If tier is `standard-*` or higher → PITR is on; rollback window is shown by
  `pg:info` ("Rollback: earliest from <timestamp>").
- If tier is `essential-*` → **schedule logical backups** (below); there is no
  PITR.

### Scheduled logical backups (do this regardless of tier)

```bash
heroku pg:backups:schedule DATABASE_URL --at '02:00 UTC' -a <app>
heroku pg:backups:schedules -a <app>     # confirm the schedule
```

### Manual backup / list / download

```bash
heroku pg:backups:capture -a <app>
heroku pg:backups -a <app>
heroku pg:backups:download -a <app>      # downloads latest.dump
```

### Restore commands

**Restore a logical backup into the live database** (destructive — overwrites
current data; that is why the `--confirm` guard exists):

```bash
# Restore the most recent backup:
heroku pg:backups:restore -a <app> --confirm <app>

# Restore a specific backup id (from `pg:backups`):
heroku pg:backups:restore b101 DATABASE_URL -a <app> --confirm <app>
```

**Point-in-Time Recovery** (Standard+ only) — provisions a *new* database forked
to a timestamp, so you can inspect before swapping it in:

```bash
heroku addons:create heroku-postgresql:standard-0 \
  --rollback DATABASE_URL \
  --to '2026-05-28 14:00 UTC' \
  -a <app>
# Then promote the recovered DB once verified:
heroku pg:promote <new-database-url> -a <app>
```

### Restore drill (do once, document the result)

1. `heroku pg:backups:capture -a <app>`
2. Spin up a throwaway DB: `heroku addons:create heroku-postgresql:essential-0 -a <app> --as RESTORE_TEST`
3. `heroku pg:backups:restore <id> RESTORE_TEST_URL -a <app> --confirm <app>`
4. Verify row counts match, then `heroku addons:destroy RESTORE_TEST -a <app> --confirm <app>`.

A backup you have never restored is not a backup.

---

## 3. Mapbox token hardening

`NEXT_PUBLIC_MAPBOX_TOKEN` is a **public** token — it is inlined into the browser
bundle by design, so it cannot be kept secret. Protection comes from *restricting
where it can be used* and *capping spend*, both configured at
<https://account.mapbox.com>. No code change is needed; the map components
already degrade gracefully when the token is absent.

### a. URL-restrict the production token

1. <https://account.mapbox.com/access-tokens/> → open the production token.
2. Under **URL restrictions**, add your production origin(s) only:
   - `https://<your-prod-domain>/*`
   - add `https://*.<your-prod-domain>/*` if you serve from subdomains.
3. Save. The token now 403s if used from any other origin (e.g. someone copying
   it into their own site).

> URL restrictions break `localhost`. Use a **separate, unrestricted dev token**
> in `frontend/.env.local`, and set the restricted token only in the production
> deploy env. Never reuse the prod token locally.

### b. Minimize scopes

The default public token scopes (`styles:read`, `fonts:read`, `datasets:read`,
plus geocoding/directions read) are all the app needs. Do **not** grant any
secret/write scopes (`*:write`, `downloads:read` for SDK installs, etc.) to a
public token.

### c. Usage alarm at 80% of free tier

Free tier ≈ 50,000 map loads/month → alarm threshold ≈ **40,000**.

1. <https://account.mapbox.com/> → **Account → Usage / Billing**.
2. Set a **usage alert / billing notification** at the 80% threshold (email).
3. Recommended: also set a **hard usage limit** or token **rate limit** so a
   runaway client or scraped token cannot generate a surprise bill.

---

## 4. Uptime monitoring

Monitor both tiers from an external service (UptimeRobot free tier or
BetterStack). External probing catches outages your own infra can't report.

### Endpoints to monitor

| What | URL | Expect |
|------|-----|--------|
| Backend health | `https://<backend-host>/api/health` | HTTP 200, body `"status":"ok"` |
| Backend liveness | `https://<backend-host>/api/health/live` | HTTP 200 (cheap, no DB) |
| Frontend root | `https://<your-prod-domain>/` | HTTP 200 |

The health endpoint ([`health.controller.ts`](../backend/src/modules/health/health.controller.ts))
checks DB **and** Redis and returns `status: "ok"` only when both are up — so a
keyword check on `"status":"ok"` detects partial outages that a bare HTTP-200
check would miss.

### UptimeRobot setup (dashboard)

1. <https://uptimerobot.com> → **Add New Monitor**.
2. For the backend: type **Keyword**, URL `https://<backend-host>/api/health`,
   keyword `"status":"ok"`, alert when keyword **not** present, interval 5 min.
3. For the frontend: type **HTTP(s)**, URL `https://<your-prod-domain>/`,
   interval 5 min.
4. Add an alert contact (email/SMS/Slack) and attach it to both monitors.
5. Optional: enable a public status page.

### BetterStack alternative

Same two checks; use **Heartbeat/Uptime** monitors, set "expected status 200"
and (backend) a response-body match on `status":"ok`. BetterStack also ingests
Heroku/Sentry, so it can correlate downtime with the error spike in Sentry.
