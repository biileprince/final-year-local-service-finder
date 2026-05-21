import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import {
  ProvidersRepository,
  CreateProviderData,
  UpdateProviderData,
  ProviderSearchParams,
} from "./providers.repository";
import { CacheService } from "../../cache/cache.service";
import { MetricsService } from "../../monitoring/metrics.service";
import { PrismaService } from "../../database/prisma.service";

// Prisma serializes Decimal columns as strings, which trips up frontend code
// that checks `typeof p.latitude === "number"`. The search endpoint already
// coerces; mirror that for direct-fetch endpoints so map pins render.
function normalizeProvider<T extends Record<string, unknown>>(p: T): T {
  if (!p) return p;
  const num = (v: unknown) =>
    v === null || v === undefined ? v : Number(v as string | number);
  return {
    ...p,
    latitude: num((p as { latitude?: unknown }).latitude),
    longitude: num((p as { longitude?: unknown }).longitude),
    hourlyRate: num((p as { hourlyRate?: unknown }).hourlyRate),
    rating: num((p as { rating?: unknown }).rating),
  } as T;
}

@Injectable()
export class ProvidersService {
  constructor(
    private readonly providersRepository: ProvidersRepository,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(data: CreateProviderData) {
    // Check if user already has a provider profile
    const existing = await this.providersRepository.findByUserId(data.userId);
    if (existing) {
      throw new ConflictException("User already has a provider profile");
    }

    const provider = await this.providersRepository.create(data);

    // Invalidate search cache
    await this.cacheService.invalidateProviderSearch();

    return provider;
  }

  async findById(id: string) {
    // Try cache first
    const cached = await this.cacheService.getProviderProfile(id);
    if (cached) {
      this.metricsService.cacheHits.inc({ cache_type: "provider" });
      // Normalize on the way out: old cache entries written before the
      // Decimal-coercion change still hold strings, and the frontend's
      // `typeof === "number"` check rejects them. Coercing here is cheap and
      // makes the rollout safe without forcing a cache flush.
      return normalizeProvider(cached as Record<string, unknown>);
    }

    this.metricsService.cacheMisses.inc({ cache_type: "provider" });

    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const normalized = normalizeProvider(provider);

    // Cache the normalized shape so subsequent cache hits return numbers too.
    await this.cacheService.setProviderProfile(id, normalized);

    return normalized;
  }

  async findByUserId(userId: string) {
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) {
      throw new NotFoundException("Provider profile not found");
    }
    return normalizeProvider(provider);
  }

  async update(id: string, userId: string, data: UpdateProviderData) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    // Ensure user owns this provider profile
    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }

    const updated = await this.providersRepository.update(id, data);

    // Invalidate caches
    await Promise.all([
      this.cacheService.invalidateProviderProfile(id),
      this.cacheService.invalidateProviderSearch(),
    ]);

    return updated;
  }

  async updateCategories(id: string, userId: string, categoryIds: string[]) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }

    const updated = await this.providersRepository.updateCategories(
      id,
      categoryIds,
    );

    await Promise.all([
      this.cacheService.invalidateProviderProfile(id),
      this.cacheService.invalidateProviderSearch(),
    ]);

    return updated;
  }

  async updateSpecialties(id: string, userId: string, specialties: string[]) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }

    const updated = await this.providersRepository.updateSpecialties(
      id,
      specialties,
    );

    await Promise.all([
      this.cacheService.invalidateProviderProfile(id),
      this.cacheService.invalidateProviderSearch(),
    ]);

    return updated;
  }

  async search(params: ProviderSearchParams) {
    const cacheKey = `${params.categoryId || "all"}:${params.location || "all"}:${params.page || 1}`;

    // Try cache for search results
    const cached = await this.cacheService.getProviderSearch(
      params.categoryId || "all",
      params.location || "all",
      params.page || 1,
    );

    if (cached && !params.search) {
      this.metricsService.cacheHits.inc({ cache_type: "provider_search" });
      return cached;
    }

    this.metricsService.cacheMisses.inc({ cache_type: "provider_search" });

    const result = await this.providersRepository.search(params);

    // Track search metrics
    this.metricsService.searchQueries.inc({
      category: params.categoryId || "all",
      has_results: result.total > 0 ? "true" : "false",
    });

    // Cache search results if not a text search
    if (!params.search) {
      await this.cacheService.setProviderSearch(
        params.categoryId || "all",
        params.location || "all",
        params.page || 1,
        result,
      );
    }

    return result;
  }

  async getFeaturedProviders(limit: number = 6) {
    const providers = await this.providersRepository.getFeaturedProviders(limit);
    return providers.map((p) => normalizeProvider(p));
  }

  async updateRating(providerId: string) {
    const updated = await this.providersRepository.updateRating(providerId);
    await this.cacheService.invalidateProviderProfile(providerId);
    return updated;
  }

  async incrementBookingCount(providerId: string, completed: boolean = false) {
    return this.providersRepository.incrementBookingCount(providerId, completed);
  }

  async addGalleryItems(
    id: string,
    userId: string,
    fileIds: string[],
  ) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) throw new NotFoundException("Provider not found");
    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }
    if (fileIds.length === 0) return [];

    const existing = await this.prisma.providerGallery.findMany({
      where: { providerId: id, deletedAt: null },
      select: { displayOrder: true },
      orderBy: { displayOrder: "desc" },
      take: 1,
    });
    let nextOrder = (existing[0]?.displayOrder ?? -1) + 1;

    const created = await this.prisma.$transaction(
      fileIds.map((fileId) =>
        this.prisma.providerGallery.upsert({
          where: { providerId_fileId: { providerId: id, fileId } },
          create: {
            providerId: id,
            fileId,
            displayOrder: nextOrder++,
          },
          update: { deletedAt: null },
          include: { file: true },
        }),
      ),
    );

    await this.cacheService.invalidateProviderProfile(id);
    return created;
  }

  async setVerificationDocuments(
    id: string,
    userId: string,
    docs: { idDocumentId?: string | null; businessLicenseId?: string | null },
  ) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) throw new NotFoundException("Provider not found");
    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }

    const data: {
      idDocumentId?: string | null;
      businessLicenseId?: string | null;
    } = {};
    if (docs.idDocumentId !== undefined) data.idDocumentId = docs.idDocumentId;
    if (docs.businessLicenseId !== undefined)
      data.businessLicenseId = docs.businessLicenseId;

    const updated = await this.prisma.provider.update({
      where: { id },
      data,
      include: { idDocument: true, businessLicense: true },
    });

    await this.cacheService.invalidateProviderProfile(id);
    return updated;
  }

  async removeGalleryItem(id: string, userId: string, galleryItemId: string) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) throw new NotFoundException("Provider not found");
    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this provider");
    }

    await this.prisma.providerGallery.update({
      where: { id: galleryItemId },
      data: { deletedAt: new Date() },
    });

    await this.cacheService.invalidateProviderProfile(id);
    return { success: true };
  }

  async delete(id: string, userId: string) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to delete this provider");
    }

    await this.providersRepository.softDelete(id);

    await Promise.all([
      this.cacheService.invalidateProviderProfile(id),
      this.cacheService.invalidateProviderSearch(),
    ]);

    return { message: "Provider deleted successfully" };
  }
}
