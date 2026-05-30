// =============================================================================
// Local Service Finder — Performance / Load Test (Chapter 5, Section 5.4)
// =============================================================================
//
// Simulates 50 concurrent virtual users exercising the most frequent, read-heavy
// endpoints. Reports the median (p50) and 95th-percentile (p95) response time
// per endpoint against the 300 ms design target, plus the error rate.
//
// USAGE
//   1. Install k6:            winget install k6 --id Grafana.k6
//   2. Seed the database so search has data to return (see prisma/seed.ts).
//   3. Point BASE_URL at your running API (note the global /api prefix):
//        # local:
//        k6 run -e BASE_URL=http://localhost:3001/api loadtest/k6-search.js
//        # deployed:
//        k6 run -e BASE_URL=https://your-api-host/api loadtest/k6-search.js
//
// OUTPUT → Table 5.3 / Figure 5.2
//   k6 prints, per custom metric below, avg / min / med / max / p(90) / p(95).
//   Read med (= p50) and p(95) for each endpoint straight into Table 5.3, and
//   `http_req_failed` for the error-rate column.
// =============================================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api";

// Cape Coast Metropolis centre — used for the radius search.
const LAT = __ENV.LAT || "5.1054";
const LNG = __ENV.LNG || "-1.2466";
const RADIUS_KM = __ENV.RADIUS_KM || "5";

// Per-endpoint response-time trends so each row of Table 5.3 is isolated.
const tSearch = new Trend("rt_search_providers", true);
const tProfile = new Trend("rt_provider_profile", true);
const tCategories = new Trend("rt_categories", true);
const errors = new Rate("endpoint_errors");

export const options = {
  scenarios: {
    sustained_load: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || "1m",
    },
  },
  thresholds: {
    // Design target from Section 5.4: p95 under 300 ms, <1% errors.
    rt_search_providers: ["p(95)<300"],
    rt_provider_profile: ["p(95)<300"],
    rt_categories: ["p(95)<300"],
    endpoint_errors: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

// setup() runs once: grab a few real provider IDs so the profile endpoint hits
// existing records rather than 404s.
export function setup() {
  const res = http.get(
    `${BASE_URL}/search/providers?lat=${LAT}&lng=${LNG}&radiusKm=${RADIUS_KM}&limit=20`,
  );
  let ids = [];
  try {
    const body = res.json();
    const items = (body && body.data && body.data.items) || body.items || [];
    ids = items.map((p) => p.id).filter(Boolean);
  } catch (e) {
    // leave ids empty; the profile step will be skipped
  }
  return { ids };
}

export default function (data) {
  // 1) Radius-based provider search — the most algorithmically demanding query.
  const search = http.get(
    `${BASE_URL}/search/providers?lat=${LAT}&lng=${LNG}&radiusKm=${RADIUS_KM}&sortBy=relevance&limit=20`,
    { tags: { name: "search/providers" } },
  );
  tSearch.add(search.timings.duration);
  errors.add(search.status >= 400);
  check(search, { "search 200": (r) => r.status === 200 });

  // 2) Single provider profile (cache-friendly read).
  const ids = (data && data.ids) || [];
  if (ids.length > 0) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const profile = http.get(`${BASE_URL}/providers/${id}`, {
      tags: { name: "providers/:id" },
    });
    tProfile.add(profile.timings.duration);
    errors.add(profile.status >= 400);
    check(profile, { "profile 200": (r) => r.status === 200 });
  }

  // 3) Category listing (browse + filter chips).
  const cats = http.get(`${BASE_URL}/categories`, {
    tags: { name: "categories" },
  });
  tCategories.add(cats.timings.duration);
  errors.add(cats.status >= 400);
  check(cats, { "categories 200": (r) => r.status === 200 });

  sleep(1); // ~1 req-set per VU per second, a realistic browse cadence
}
