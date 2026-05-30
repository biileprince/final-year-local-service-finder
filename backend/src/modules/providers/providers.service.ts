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

    // Seed default Mon-Sat 9-5 hours for new providers
    await this.initDefaultHours(provider.id);

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
    // A rating change feeds the review-quality component of the trust score,
    // so refresh both together (Section 4.6.4).
    await this.providersRepository.updateRating(providerId);
    const updated =
      await this.providersRepository.recomputeTrustScore(providerId);
    await this.cacheService.invalidateProviderProfile(providerId);
    return updated;
  }

  /**
   * Recompute the provider's composite trust score from its current counters
   * and invalidate the cached profile. Called by the booking lifecycle when a
   * completion, cancellation or no-show changes the objective inputs.
   */
  async recomputeTrustScore(providerId: string) {
    const updated =
      await this.providersRepository.recomputeTrustScore(providerId);
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

  // ---------------------------------------------------------------------------
  // Business hours
  // ---------------------------------------------------------------------------

  /** Default Mon-Sat 09:00-17:00, Sunday closed. */
  static readonly DEFAULT_HOURS = Array.from({ length: 7 }, (_, day) => ({
    dayOfWeek: day,
    openMinutes: 540,
    closeMinutes: 1020,
    isClosed: day === 0, // Sunday closed
  }));

  async initDefaultHours(providerId: string): Promise<void> {
    const existing = await this.prisma.providerHours.count({
      where: { providerId },
    });
    if (existing > 0) return;
    await this.prisma.providerHours.createMany({
      data: ProvidersService.DEFAULT_HOURS.map((h) => ({ ...h, providerId })),
    });
  }

  async getHours(providerId: string) {
    return this.prisma.providerHours.findMany({
      where: { providerId },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  async getHoursByUserId(userId: string) {
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) throw new NotFoundException("Provider profile not found");
    return this.getHours(provider.id);
  }

  async upsertHours(
    userId: string,
    days: Array<{
      dayOfWeek: number;
      openMinutes?: number;
      closeMinutes?: number;
      isClosed?: boolean;
    }>,
  ) {
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) throw new NotFoundException("Provider profile not found");

    await this.prisma.$transaction(
      days.map((d) =>
        this.prisma.providerHours.upsert({
          where: {
            providerId_dayOfWeek: {
              providerId: provider.id,
              dayOfWeek: d.dayOfWeek,
            },
          },
          create: {
            providerId: provider.id,
            dayOfWeek: d.dayOfWeek,
            openMinutes: d.openMinutes ?? 540,
            closeMinutes: d.closeMinutes ?? 1020,
            isClosed: d.isClosed ?? false,
          },
          update: {
            openMinutes: d.openMinutes ?? 540,
            closeMinutes: d.closeMinutes ?? 1020,
            isClosed: d.isClosed ?? false,
          },
        }),
      ),
    );

    return this.getHours(provider.id);
  }

  // ---------------------------------------------------------------------------
  // Provider services (service-level pricing)
  // ---------------------------------------------------------------------------

  async getServices(providerId: string, activeOnly = false) {
    return this.prisma.providerService.findMany({
      where: {
        providerId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async getServicesByUserId(userId: string) {
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) throw new NotFoundException("Provider profile not found");
    return this.getServices(provider.id);
  }

  async createService(
    userId: string,
    data: {
      name: string;
      basePrice: number;
      durationMin?: number;
      description?: string;
      categoryId?: string;
      isActive?: boolean;
    },
  ) {
    const provider = await this.providersRepository.findByUserId(userId);
    if (!provider) throw new NotFoundException("Provider profile not found");

    return this.prisma.providerService.create({
      data: {
        providerId: provider.id,
        name: data.name,
        basePrice: data.basePrice,
        durationMin: data.durationMin ?? 60,
        description: data.description,
        categoryId: data.categoryId ?? null,
        isActive: data.isActive ?? true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async updateService(
    userId: string,
    serviceId: string,
    data: {
      name?: string;
      basePrice?: number;
      durationMin?: number;
      description?: string;
      categoryId?: string;
      isActive?: boolean;
    },
  ) {
    const svc = await this.prisma.providerService.findUnique({
      where: { id: serviceId },
      include: { provider: { select: { userId: true } } },
    });
    if (!svc) throw new NotFoundException("Service not found");
    if (svc.provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to update this service");
    }

    return this.prisma.providerService.update({
      where: { id: serviceId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(data.durationMin !== undefined && { durationMin: data.durationMin }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async deleteService(userId: string, serviceId: string) {
    const svc = await this.prisma.providerService.findUnique({
      where: { id: serviceId },
      include: { provider: { select: { userId: true } } },
    });
    if (!svc) throw new NotFoundException("Service not found");
    if (svc.provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to delete this service");
    }

    await this.prisma.providerService.delete({ where: { id: serviceId } });
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
