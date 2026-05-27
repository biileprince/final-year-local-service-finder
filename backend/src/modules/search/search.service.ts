import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";
import {
  AdvancedSearchProvidersDto,
  ProviderSortBy,
} from "./dto/search-providers.dto";

const MIN_TRIGRAM_SIM = 0.18;
const MAX_LIMIT = 50;
const EARTH_RADIUS_KM = 6371;

interface ProviderRankRow {
  id: string;
  relevance: number;
  distance_km: number | null;
}

export interface SuggestGroupItem {
  type: "category" | "provider" | "specialty" | "location";
  id?: string;
  label: string;
  sublabel?: string;
  href: string;
  icon?: string;
  imageUrl?: string;
}

export interface SuggestPayload {
  query: string;
  groups: {
    categories: SuggestGroupItem[];
    providers: SuggestGroupItem[];
    specialties: SuggestGroupItem[];
    locations: SuggestGroupItem[];
  };
  /** If the user hits Enter, where should we send them? */
  topHit?: SuggestGroupItem;
}

export interface LocationStat {
  location: string;
  providerCount: number;
}

export interface TrendingPayload {
  /** Categories with the most bookings in the last 30 days, falling back to
   *  highest providerCount when there's no booking history yet. */
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
    providerCount: number;
    bookings30d: number;
    imageUrl?: string;
  }>;
  topSearches: string[];
  popularProviders: Array<{
    id: string;
    name: string;
    location: string;
    rating: number;
    reviewCount: number;
    profileImage: string | null;
    primaryCategory?: string;
  }>;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ===========================================================================
  // Suggest (typeahead / overlay)
  // ===========================================================================

  /**
   * Returns lightweight grouped suggestions for an overlay. Uses pg_trgm
   * similarity to fuzz-match across categories, provider names, specialties,
   * and known locations. Always cheap: each block is a single SQL query
   * capped at `limit` rows.
   */
  async suggest(q: string, limit = 5): Promise<SuggestPayload> {
    const query = q.trim();
    if (!query) {
      return { query: "", groups: this.emptyGroups() };
    }
    const capped = Math.min(limit, MAX_LIMIT);
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
    const cleanQ = query.slice(0, 80);

    const [categories, providers, specialties, locations] = await Promise.all([
      this.suggestCategories(cleanQ, pattern, capped),
      this.suggestProviders(cleanQ, pattern, capped),
      this.suggestSpecialties(cleanQ, pattern, capped),
      this.suggestLocations(cleanQ, pattern, capped),
    ]);

    const groups = { categories, providers, specialties, locations };
    const topHit =
      providers[0] ?? categories[0] ?? specialties[0] ?? locations[0];

    return { query, groups, topHit };
  }

  private async suggestCategories(
    q: string,
    pattern: string,
    limit: number,
  ): Promise<SuggestGroupItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        slug: string;
        icon: string | null;
        color: string | null;
        image_url: string | null;
        provider_count: number;
        sim: number;
      }>
    >`
      SELECT c.id, c.name, c.slug, c.icon, c.color,
             f.url AS image_url,
             c.provider_count,
             GREATEST(similarity(c.name, ${q}),
                      similarity(COALESCE(c.description, ''), ${q})) AS sim
      FROM categories c
      LEFT JOIN files f ON f.id = c.image_id
      WHERE c.deleted_at IS NULL
        AND c.is_active = TRUE
        AND (
          c.name ILIKE ${pattern}
          OR c.description ILIKE ${pattern}
          OR similarity(c.name, ${q}) > ${MIN_TRIGRAM_SIM}
        )
      ORDER BY sim DESC, c.provider_count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      type: "category" as const,
      id: r.id,
      label: r.name,
      sublabel: `${r.provider_count} provider${r.provider_count === 1 ? "" : "s"}`,
      href: `/search?category=${encodeURIComponent(r.slug)}`,
      icon: r.icon ?? undefined,
      imageUrl: r.image_url ?? undefined,
    }));
  }

  private async suggestProviders(
    q: string,
    pattern: string,
    limit: number,
  ): Promise<SuggestGroupItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        location: string;
        avatar_url: string | null;
        category_name: string | null;
        rating: number;
        sim: number;
      }>
    >`
      SELECT p.id,
             u.name,
             p.location,
             u.avatar_url,
             (SELECT c.name FROM provider_categories pc
                JOIN categories c ON c.id = pc.category_id
                WHERE pc.provider_id = p.id
                ORDER BY pc.is_primary DESC LIMIT 1) AS category_name,
             p.rating::float AS rating,
             GREATEST(
               similarity(u.name, ${q}),
               COALESCE(similarity(p.bio, ${q}), 0),
               similarity(p.location, ${q})
             ) AS sim
      FROM providers p
      JOIN users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL
        AND p.is_active = TRUE
        AND (
          u.name ILIKE ${pattern}
          OR p.location ILIKE ${pattern}
          OR p.bio ILIKE ${pattern}
          OR similarity(u.name, ${q}) > ${MIN_TRIGRAM_SIM}
          OR EXISTS (
            SELECT 1 FROM provider_specialties ps
              WHERE ps.provider_id = p.id
                AND (ps.specialty ILIKE ${pattern}
                     OR similarity(ps.specialty, ${q}) > ${MIN_TRIGRAM_SIM})
          )
        )
      ORDER BY sim DESC, p.rating DESC, p.review_count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      type: "provider" as const,
      id: r.id,
      label: r.name,
      sublabel: r.category_name
        ? `${r.category_name} · ${r.location}`
        : r.location,
      href: `/providers/${r.id}`,
      imageUrl: r.avatar_url ?? undefined,
    }));
  }

  private async suggestSpecialties(
    q: string,
    pattern: string,
    limit: number,
  ): Promise<SuggestGroupItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ specialty: string; matches: number; sim: number }>
    >`
      SELECT ps.specialty,
             COUNT(*)::int AS matches,
             similarity(ps.specialty, ${q}) AS sim
      FROM provider_specialties ps
      JOIN providers p ON p.id = ps.provider_id
      WHERE p.deleted_at IS NULL
        AND p.is_active = TRUE
        AND (ps.specialty ILIKE ${pattern}
             OR similarity(ps.specialty, ${q}) > ${MIN_TRIGRAM_SIM})
      GROUP BY ps.specialty
      ORDER BY sim DESC, matches DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      type: "specialty" as const,
      label: r.specialty,
      sublabel: `${r.matches} provider${r.matches === 1 ? "" : "s"}`,
      href: `/search?q=${encodeURIComponent(r.specialty)}`,
    }));
  }

  private async suggestLocations(
    q: string,
    pattern: string,
    limit: number,
  ): Promise<SuggestGroupItem[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ location: string; matches: number; sim: number }>
    >`
      SELECT p.location,
             COUNT(*)::int AS matches,
             similarity(p.location, ${q}) AS sim
      FROM providers p
      WHERE p.deleted_at IS NULL
        AND p.is_active = TRUE
        AND p.location <> ''
        AND (p.location ILIKE ${pattern}
             OR similarity(p.location, ${q}) > ${MIN_TRIGRAM_SIM})
      GROUP BY p.location
      ORDER BY sim DESC, matches DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      type: "location" as const,
      label: r.location,
      sublabel: `${r.matches} provider${r.matches === 1 ? "" : "s"} nearby`,
      href: `/search?location=${encodeURIComponent(r.location)}`,
    }));
  }

  private emptyGroups() {
    return {
      categories: [] as SuggestGroupItem[],
      providers: [] as SuggestGroupItem[],
      specialties: [] as SuggestGroupItem[],
      locations: [] as SuggestGroupItem[],
    };
  }

  // ===========================================================================
  // Trending (homepage, search default state)
  // ===========================================================================

  async trending(): Promise<TrendingPayload> {
    const cacheKey = "search:trending:v1";
    const cached = await this.cache.get<TrendingPayload>(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [categoryRows, popularProviders, topSearches] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          color: string | null;
          provider_count: number;
          bookings_30d: number;
          image_url: string | null;
        }>
      >`
        SELECT c.id, c.name, c.slug, c.icon, c.color,
               c.provider_count,
               COALESCE(b.cnt, 0)::int AS bookings_30d,
               f.url AS image_url
        FROM categories c
        LEFT JOIN files f ON f.id = c.image_id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT bk.id)::int AS cnt
          FROM bookings bk
          JOIN provider_categories pc ON pc.provider_id = bk.provider_id
          WHERE pc.category_id = c.id
            AND bk.created_at >= ${since}
            AND bk.deleted_at IS NULL
        ) b ON TRUE
        WHERE c.deleted_at IS NULL
          AND c.is_active = TRUE
          AND c.parent_id IS NULL
        ORDER BY bookings_30d DESC, c.provider_count DESC, c.display_order ASC
        LIMIT 8
      `,
      this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          location: string;
          avatar_url: string | null;
          rating: number;
          review_count: number;
          category_name: string | null;
        }>
      >`
        SELECT p.id, u.name, p.location, u.avatar_url,
               p.rating::float AS rating,
               p.review_count,
               (SELECT c.name FROM provider_categories pc
                  JOIN categories c ON c.id = pc.category_id
                  WHERE pc.provider_id = p.id
                  ORDER BY pc.is_primary DESC LIMIT 1) AS category_name
        FROM providers p
        JOIN users u ON u.id = p.user_id
        WHERE p.deleted_at IS NULL
          AND p.is_active = TRUE
          AND p.verification_status = 'VERIFIED'
        ORDER BY p.rating DESC NULLS LAST, p.review_count DESC, p.total_bookings DESC
        LIMIT 8
      `,
      this.fetchTopSearchTerms(8),
    ]);

    const payload: TrendingPayload = {
      categories: categoryRows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        icon: r.icon,
        color: r.color,
        providerCount: r.provider_count,
        bookings30d: r.bookings_30d,
        imageUrl: r.image_url ?? undefined,
      })),
      popularProviders: popularProviders.map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        rating: Number(r.rating ?? 0),
        reviewCount: r.review_count,
        profileImage: r.avatar_url,
        primaryCategory: r.category_name ?? undefined,
      })),
      topSearches,
    };

    // Trending changes slowly — 5-min TTL is plenty.
    await this.cache.set(cacheKey, payload, 300);
    return payload;
  }

  /**
   * Top locations by active provider count. Powers the homepage "Across Ghana"
   * panel — feeds real city totals instead of the hard-coded Accra/Kumasi list.
   * The grouping strips leading articles and lowercases the city name so the
   * same place isn't double-counted under variant spellings.
   */
  async topLocations(limit = 8): Promise<LocationStat[]> {
    const cacheKey = `search:top-locations:v1:${limit}`;
    const cached = await this.cache.get<LocationStat[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.$queryRaw<
      Array<{ location: string; cnt: number }>
    >`
      SELECT
        TRIM(SPLIT_PART(p.location, ',', 1)) AS location,
        COUNT(*)::int AS cnt
      FROM providers p
      WHERE p.deleted_at IS NULL
        AND p.is_active = TRUE
        AND p.location IS NOT NULL
        AND p.location <> ''
      GROUP BY TRIM(SPLIT_PART(p.location, ',', 1))
      HAVING COUNT(*) > 0
      ORDER BY cnt DESC, location ASC
      LIMIT ${Math.min(limit, 20)}
    `;

    const payload = rows.map((r) => ({
      location: r.location,
      providerCount: r.cnt,
    }));
    await this.cache.set(cacheKey, payload, 300);
    return payload;
  }

  /**
   * Top recent search terms — pulled from a Redis sorted set we populate on
   * every server-side search. Falls back gracefully if Redis is empty (fresh
   * deploy) by returning the most popular category names instead.
   */
  private async fetchTopSearchTerms(limit: number): Promise<string[]> {
    const fromRedis = await this.cache.getTopSearchTerms(limit).catch(() => []);
    if (fromRedis.length > 0) return fromRedis;
    const fallback = await this.prisma.category.findMany({
      where: { isActive: true, deletedAt: null, parentId: null },
      orderBy: [{ providerCount: "desc" }, { displayOrder: "asc" }],
      select: { name: true },
      take: limit,
    });
    return fallback.map((c) => c.name);
  }

  // ===========================================================================
  // Advanced provider search (main /search results page)
  // ===========================================================================

  async searchProviders(dto: AdvancedSearchProvidersDto) {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, dto.limit ?? 20));
    const offset = (page - 1) * limit;
    const sortBy = dto.sortBy ?? ProviderSortBy.RELEVANCE;

    const q = dto.q?.trim() ?? "";
    const hasQuery = q.length > 0;
    const hasGeo =
      typeof dto.lat === "number" && typeof dto.lng === "number" && !isNaN(dto.lat);
    const radiusKm = Math.min(200, Math.max(1, dto.radiusKm ?? 25));

    // Asynchronously record the query for trending — never block on this.
    if (hasQuery) {
      void this.cache.recordSearchTerm(q).catch(() => undefined);
    }

    // Bounding-box deltas in degrees (≈ 111 km per degree of latitude).
    const latDelta = hasGeo ? radiusKm / 111 : null;
    const lngDelta = hasGeo
      ? radiusKm /
        (111 *
          Math.max(0.01, Math.cos(((dto.lat ?? 0) * Math.PI) / 180)))
      : null;

    // ---- Build WHERE / ORDER fragments with Prisma.sql safety helpers -----

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.is_active = TRUE`,
      // Only verified providers ever appear in the public results list.
      // Pending/rejected providers stay hidden from customers — they're only
      // surfaced in the admin verification queue. (The `verified` query param
      // is now a no-op kept for URL backward-compat.)
      Prisma.sql`p.verification_status = 'VERIFIED'`,
    ];
    if (typeof dto.minRating === "number") {
      conditions.push(Prisma.sql`p.rating >= ${dto.minRating}`);
    }
    if (typeof dto.maxHourlyRate === "number") {
      conditions.push(Prisma.sql`p.hourly_rate <= ${dto.maxHourlyRate}`);
    }
    if (dto.location) {
      const locPattern = `%${dto.location.replace(/[%_]/g, "\\$&")}%`;
      conditions.push(
        Prisma.sql`(p.location ILIKE ${locPattern} OR similarity(p.location, ${dto.location}) > ${MIN_TRIGRAM_SIM})`,
      );
    }
    if (dto.categoryIds && dto.categoryIds.length > 0) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM provider_categories pc WHERE pc.provider_id = p.id AND pc.category_id IN (${Prisma.join(
          dto.categoryIds,
        )}))`,
      );
    }
    if (hasGeo && latDelta !== null && lngDelta !== null) {
      conditions.push(
        Prisma.sql`p.latitude BETWEEN ${dto.lat! - latDelta} AND ${dto.lat! + latDelta}`,
      );
      conditions.push(
        Prisma.sql`p.longitude BETWEEN ${dto.lng! - lngDelta} AND ${dto.lng! + lngDelta}`,
      );
    }

    const textPattern = hasQuery ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
    if (hasQuery) {
      conditions.push(
        Prisma.sql`(
          u.name ILIKE ${textPattern}
          OR p.location ILIKE ${textPattern}
          OR p.bio ILIKE ${textPattern}
          OR similarity(u.name, ${q}) > ${MIN_TRIGRAM_SIM}
          OR similarity(COALESCE(p.bio, ''), ${q}) > ${MIN_TRIGRAM_SIM}
          OR EXISTS (
            SELECT 1 FROM provider_specialties ps
            WHERE ps.provider_id = p.id
              AND (ps.specialty ILIKE ${textPattern}
                   OR similarity(ps.specialty, ${q}) > ${MIN_TRIGRAM_SIM})
          )
          OR EXISTS (
            SELECT 1 FROM provider_categories pc
              JOIN categories c ON c.id = pc.category_id
              WHERE pc.provider_id = p.id
                AND (c.name ILIKE ${textPattern}
                     OR similarity(c.name, ${q}) > ${MIN_TRIGRAM_SIM})
          )
        )`,
      );
    }

    const whereSql = Prisma.sql`${Prisma.join(conditions, " AND ")}`;

    // ---- Relevance + distance expressions ---------------------------------

    const relevanceSql = hasQuery
      ? Prisma.sql`
          GREATEST(
            similarity(u.name, ${q}),
            COALESCE(similarity(p.bio, ${q}), 0),
            similarity(p.location, ${q}),
            COALESCE((SELECT MAX(similarity(ps.specialty, ${q}))
                      FROM provider_specialties ps
                      WHERE ps.provider_id = p.id), 0),
            COALESCE((SELECT MAX(similarity(c.name, ${q}))
                      FROM provider_categories pc
                      JOIN categories c ON c.id = pc.category_id
                      WHERE pc.provider_id = p.id), 0)
          )`
      : Prisma.sql`0::float`;

    const distanceSql = hasGeo
      ? Prisma.sql`(
          ${EARTH_RADIUS_KM} * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(${dto.lat!})) * cos(radians(p.latitude::float)) *
              cos(radians(p.longitude::float) - radians(${dto.lng!})) +
              sin(radians(${dto.lat!})) * sin(radians(p.latitude::float))
            ))
          )
        )`
      : Prisma.sql`NULL`;

    // Order-by per sortBy. Relevance is a tie-breaker rather than the only
    // signal: even with a query, an exact-match on a 5-star verified provider
    // should beat a slightly-better trigram match on an unverified one.
    let orderSql: Prisma.Sql;
    switch (sortBy) {
      case ProviderSortBy.RATING:
        orderSql = Prisma.sql`p.rating DESC NULLS LAST, p.review_count DESC`;
        break;
      case ProviderSortBy.REVIEWS:
        orderSql = Prisma.sql`p.review_count DESC, p.rating DESC NULLS LAST`;
        break;
      case ProviderSortBy.DISTANCE:
        orderSql = hasGeo
          ? Prisma.sql`distance_km ASC NULLS LAST, p.rating DESC`
          : Prisma.sql`p.rating DESC NULLS LAST, p.review_count DESC`;
        break;
      case ProviderSortBy.NEWEST:
        orderSql = Prisma.sql`p.created_at DESC`;
        break;
      case ProviderSortBy.PRICE_LOW:
        orderSql = Prisma.sql`p.hourly_rate ASC, p.rating DESC`;
        break;
      case ProviderSortBy.PRICE_HIGH:
        orderSql = Prisma.sql`p.hourly_rate DESC, p.rating DESC`;
        break;
      case ProviderSortBy.RELEVANCE:
      default:
        orderSql = hasQuery
          ? Prisma.sql`relevance DESC, p.rating DESC NULLS LAST, p.review_count DESC`
          : hasGeo
            ? Prisma.sql`distance_km ASC, p.rating DESC NULLS LAST`
            : Prisma.sql`p.featured DESC, p.rating DESC NULLS LAST, p.review_count DESC`;
        break;
    }

    // ---- Execute count + ranked-id pull ----------------------------------

    const [countRow, rankedRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*)::bigint AS total
        FROM providers p
        JOIN users u ON u.id = p.user_id
        WHERE ${whereSql}
      `,
      this.prisma.$queryRaw<ProviderRankRow[]>`
        SELECT p.id,
               ${relevanceSql} AS relevance,
               ${distanceSql} AS distance_km
        FROM providers p
        JOIN users u ON u.id = p.user_id
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = Number(countRow[0]?.total ?? 0n);
    const ids = rankedRows.map((r) => r.id);
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    const distanceMap = new Map(
      rankedRows.map((r) => [r.id, r.distance_km] as const),
    );

    // Hydrate via Prisma to keep typed includes.
    const hydrated = ids.length
      ? await this.prisma.provider.findMany({
          where: { id: { in: ids } },
          include: {
            user: {
              select: { id: true, name: true, profileImage: true },
            },
            categories: {
              include: {
                category: {
                  select: { id: true, name: true, slug: true, icon: true, color: true },
                },
              },
            },
            specialties: { select: { specialty: true } },
          },
        })
      : [];

    const ordered = hydrated
      .map((p) => ({
        ...p,
        rating: Number(p.rating),
        hourlyRate: Number(p.hourlyRate),
        latitude: p.latitude ? Number(p.latitude) : null,
        longitude: p.longitude ? Number(p.longitude) : null,
        distanceKm: distanceMap.get(p.id) ?? null,
      }))
      .sort(
        (a, b) =>
          (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );

    return {
      items: ordered,
      providers: ordered, // legacy alias for the existing frontend client
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      meta: {
        query: q,
        hasGeo,
        radiusKm: hasGeo ? radiusKm : null,
        sortBy,
      },
    };
  }
}
