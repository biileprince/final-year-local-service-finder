import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  // Cache TTLs (in seconds)
  static readonly TTL = {
    PROVIDER_SEARCH: 300, // 5 minutes
    PROVIDER_PROFILE: 300, // 5 minutes
    CATEGORIES: 86400, // 24 hours
    AVAILABILITY: 60, // 1 minute
    USER_SESSION: 604800, // 7 days
    RATE_LIMIT: 60, // 1 minute
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Prefer REDIS_URL (Upstash/Heroku Redis style). Falls back to discrete
    // host/port/password for local docker-compose. rediss:// in the URL flips
    // ioredis into TLS mode automatically.
    const redisUrl = this.configService.get<string>("REDIS_URL");
    const retryStrategy = (times: number) => Math.min(times * 50, 2000);

    this.redis = redisUrl
      ? new Redis(redisUrl, {
          retryStrategy,
          maxRetriesPerRequest: 3,
        })
      : new Redis({
          host: this.configService.get("REDIS_HOST", "localhost"),
          port: this.configService.get("REDIS_PORT", 6379),
          password: this.configService.get("REDIS_PASSWORD"),
          retryStrategy,
        });

    this.redis.on("connect", () => {
      this.logger.log("Redis connection established");
    });

    this.redis.on("error", (error) => {
      this.logger.error("Redis connection error:", error.message);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log("Redis connection closed");
  }

  // ============================================================================
  // Basic Operations
  // ============================================================================

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  // ============================================================================
  // Pattern Operations
  // ============================================================================

  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  async getKeys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  // ============================================================================
  // Provider Caching
  // ============================================================================

  async getProviderSearch(
    category: string,
    location: string,
    page: number,
  ): Promise<unknown | null> {
    const key = `provider:search:${category}:${location}:${page}`;
    return this.get(key);
  }

  async setProviderSearch(
    category: string,
    location: string,
    page: number,
    data: unknown,
  ): Promise<void> {
    const key = `provider:search:${category}:${location}:${page}`;
    await this.set(key, data, CacheService.TTL.PROVIDER_SEARCH);
  }

  async invalidateProviderSearch(): Promise<void> {
    await this.delByPattern("provider:search:*");
  }

  async getProviderProfile(providerId: string): Promise<unknown | null> {
    return this.get(`provider:${providerId}`);
  }

  async setProviderProfile(providerId: string, data: unknown): Promise<void> {
    await this.set(
      `provider:${providerId}`,
      data,
      CacheService.TTL.PROVIDER_PROFILE,
    );
  }

  async invalidateProviderProfile(providerId: string): Promise<void> {
    await this.del(`provider:${providerId}`);
  }

  // ============================================================================
  // Category Caching
  // ============================================================================

  async getCategories(): Promise<unknown | null> {
    return this.get("categories:all");
  }

  async setCategories(data: unknown): Promise<void> {
    await this.set("categories:all", data, CacheService.TTL.CATEGORIES);
  }

  async invalidateCategories(): Promise<void> {
    await this.delByPattern("categories:*");
  }

  // ============================================================================
  // Availability Caching
  // ============================================================================

  async getAvailability(
    providerId: string,
    date: string,
  ): Promise<unknown | null> {
    return this.get(`availability:${providerId}:${date}`);
  }

  async setAvailability(
    providerId: string,
    date: string,
    data: unknown,
  ): Promise<void> {
    await this.set(
      `availability:${providerId}:${date}`,
      data,
      CacheService.TTL.AVAILABILITY,
    );
  }

  async invalidateAvailability(
    providerId: string,
    date?: string,
  ): Promise<void> {
    if (date) {
      await this.del(`availability:${providerId}:${date}`);
    } else {
      await this.delByPattern(`availability:${providerId}:*`);
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async setRefreshToken(
    userId: string,
    tokenId: string,
    token: string,
  ): Promise<void> {
    await this.set(
      `refresh:${userId}:${tokenId}`,
      token,
      CacheService.TTL.USER_SESSION,
    );
  }

  async getRefreshToken(
    userId: string,
    tokenId: string,
  ): Promise<string | null> {
    return this.get(`refresh:${userId}:${tokenId}`);
  }

  async deleteRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.del(`refresh:${userId}:${tokenId}`);
  }

  async deleteAllRefreshTokens(userId: string): Promise<void> {
    await this.delByPattern(`refresh:${userId}:*`);
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  async incrementRateLimit(
    key: string,
    windowSeconds: number,
  ): Promise<number> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return current;
  }

  async getRateLimitCount(key: string): Promise<number> {
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }
}
