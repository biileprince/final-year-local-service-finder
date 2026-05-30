# Testing & Evaluation Runbook (Chapter 5)

How to generate every result in Chapter 5 from the real system. Replace each
`[SAMPLE — REPLACE]` figure in the report with the output you get here.

## 5.3 Functional testing — Jest

```bash
cd backend
npm test                     # runs all *.spec.ts
npx jest trust               # just the trust-score suites
```

Currently implemented and passing:
- `src/modules/providers/trust-score.spec.ts` — 10 unit tests for the composite
  trust engine (validates Equation 4.2 and the Section 5.7 discrimination claim).
- `src/modules/providers/providers.trust-wiring.spec.ts` — verifies the score is
  recomputed and the cache invalidated on rating change / lifecycle events.

To grow toward the full functional table (Table 5.2 / Appendix E), add Supertest
e2e specs that boot the app against a throwaway database and assert the headline
behaviours: review blocked unless `COMPLETED`, illegal state transition rejected,
role guard returns 403. Keep an honest count of automated vs manual cases.

## 5.4 Performance & load — k6

```bash
winget install k6 --id Grafana.k6      # once
# seed the DB first so search returns data
k6 run -e BASE_URL=http://localhost:3001/api loadtest/k6-search.js
# or against the deployed API:
k6 run -e BASE_URL=https://your-api-host/api -e VUS=50 -e DURATION=1m loadtest/k6-search.js
```

Read `med` (= p50) and `p(95)` per `rt_*` metric into Table 5.3, and
`http_req_failed` for the error-rate column.

## 5.5 Quality audit — Lighthouse

```bash
npx lighthouse https://local-service-finder-gh.vercel.app/ --preset=desktop --view
# and mobile (throttled) for the figure used in the report
```

The security-checklist rows in Table 5.4 are verifiable by code inspection:
bcrypt (work factor 10), Helmet, the throttler, the CSRF guard, and JWT +
rotating refresh tokens are all present in the backend.

## 5.6 Usability — System Usability Scale

See [`sus-usability-evaluation.md`](./sus-usability-evaluation.md): consent text,
task script, the 10-item questionnaire, the scoring formula and the interpretation
table. Report the mean SUS across 8–12 participants in Figure 5.4.

## 5.7 Trust-engine validation

```bash
cd backend
npx ts-node prisma/scripts/trust-validation.ts     # prints the comparison table
```

This computes the static star score vs the composite trust score for six
contrasting providers (Figure 5.5). To make the deployed app show real scores:

```bash
npx ts-node prisma/scripts/backfill-trust-scores.ts
```
