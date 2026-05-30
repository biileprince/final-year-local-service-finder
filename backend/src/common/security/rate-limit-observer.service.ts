import { Injectable } from "@nestjs/common";

export interface RateLimitEvent {
  at: string; // ISO timestamp
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
  userId?: string;
  throttler?: string; // which named limit fired (short/medium/long)
}

interface Counter {
  count: number;
  lastSeen: string;
}

const MAX_EVENTS = 500; // ring buffer cap
const MAX_KEYS = 100; // cap per-route / per-ip maps to avoid unbounded growth

/**
 * Tracks rate-limit hits so we can answer "who is getting throttled?" without
 * tailing logs. Kept entirely in-memory — counts reset on restart, which is
 * fine for an observability surface (the request log + Sentry are the durable
 * record).
 */
@Injectable()
export class RateLimitObserverService {
  private readonly events: RateLimitEvent[] = [];
  private readonly byRoute = new Map<string, Counter>();
  private readonly byIp = new Map<string, Counter>();
  private totalHits = 0;
  private firstSeenAt: string | null = null;

  record(event: RateLimitEvent): void {
    this.totalHits += 1;
    if (!this.firstSeenAt) this.firstSeenAt = event.at;

    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      // Drop oldest in batches of 50 to avoid shifting on every record.
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }

    bump(this.byRoute, `${event.method} ${event.path}`, event.at);
    bump(this.byIp, event.ip, event.at);
  }

  recent(limit = 100): RateLimitEvent[] {
    const cap = Math.min(Math.max(limit, 1), MAX_EVENTS);
    return this.events.slice(-cap).reverse();
  }

  stats() {
    return {
      totalHits: this.totalHits,
      uniqueRoutes: this.byRoute.size,
      uniqueIps: this.byIp.size,
      firstSeenAt: this.firstSeenAt,
      topRoutes: top(this.byRoute, 10),
      topIps: top(this.byIp, 10),
    };
  }
}

function bump(map: Map<string, Counter>, key: string, at: string) {
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = at;
    return;
  }
  if (map.size >= MAX_KEYS) {
    // Evict the oldest key so the map stays bounded.
    const oldestKey = [...map.entries()].sort(
      (a, b) => a[1].lastSeen.localeCompare(b[1].lastSeen),
    )[0]?.[0];
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(key, { count: 1, lastSeen: at });
}

function top(map: Map<string, Counter>, n: number) {
  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, n)
    .map(([key, c]) => ({ key, count: c.count, lastSeen: c.lastSeen }));
}
