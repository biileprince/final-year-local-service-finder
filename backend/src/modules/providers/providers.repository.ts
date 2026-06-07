import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, VerificationStatus } from "@prisma/client";
import { computeTrustScore } from "./trust-score";

export interface CreateProviderData {
  userId: string;
  bio?: string;
  hourlyRate: number;
  yearsExperience?: number;
  location: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  categoryIds?: string[];
  specialties?: string[];
}

export interface UpdateProviderData {
  bio?: string;
  hourlyRate?: number;
  yearsExperience?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  cancellationPolicy?: string;
  isActive?: boolean;
}

export interface ProviderSearchParams {
  categoryId?: string;
  location?: string;
  minRating?: number;
  maxHourlyRate?: number;
  verified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "rating" | "hourlyRate" | "reviewCount" | "createdAt";
  sortOrder?: "asc" | "desc";
}

@Injectable()
export class ProvidersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProviderData) {
    const { categoryIds, specialties, ...providerData } = data;

    return this.prisma.provider.create({
      data: {
        ...providerData,
        hourlyRate: new Prisma.Decimal(providerData.hourlyRate),
        latitude: providerData.latitude
          ? new Prisma.Decimal(providerData.latitude)
          : null,
        longitude: providerData.longitude
          ? new Prisma.Decimal(providerData.longitude)
          : null,
        categories: categoryIds
          ? {
              create: categoryIds.map((categoryId, index) => ({
                categoryId,
                isPrimary: index === 0,
              })),
            }
          : undefined,
        specialties: specialties
          ? {
              create: specialties.map((specialty) => ({ specialty })),
            }
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        specialties: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.provider.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        specialties: true,
        gallery: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
          include: {
            file: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.provider.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        specialties: true,
        gallery: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
          include: { file: true },
        },
        idDocument: true,
        businessLicense: true,
      },
    });
  }

  async update(id: string, data: UpdateProviderData) {
    const updateData: Prisma.ProviderUpdateInput = {
      ...data,
      hourlyRate: data.hourlyRate
        ? new Prisma.Decimal(data.hourlyRate)
        : undefined,
      latitude: data.latitude ? new Prisma.Decimal(data.latitude) : undefined,
      longitude: data.longitude
        ? new Prisma.Decimal(data.longitude)
        : undefined,
    };

    return this.prisma.provider.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        specialties: true,
      },
    });
  }

  async updateCategories(providerId: string, categoryIds: string[]) {
    // Delete existing categories
    await this.prisma.providerCategory.deleteMany({
      where: { providerId },
    });

    // Add new categories
    if (categoryIds.length > 0) {
      await this.prisma.providerCategory.createMany({
        data: categoryIds.map((categoryId, index) => ({
          providerId,
          categoryId,
          isPrimary: index === 0,
        })),
      });
    }

    return this.findById(providerId);
  }

  async updateSpecialties(providerId: string, specialties: string[]) {
    // Delete existing specialties
    await this.prisma.providerSpecialty.deleteMany({
      where: { providerId },
    });

    // Add new specialties
    if (specialties.length > 0) {
      await this.prisma.providerSpecialty.createMany({
        data: specialties.map((specialty) => ({
          providerId,
          specialty,
        })),
      });
    }

    return this.findById(providerId);
  }

  async search(params: ProviderSearchParams) {
    const {
      categoryId,
      location,
      minRating,
      maxHourlyRate,
      verified,
      search,
      page = 1,
      limit = 10,
      sortBy = "rating",
      sortOrder = "desc",
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.ProviderWhereInput = {
      isActive: true,
      deletedAt: null,
      verificationStatus: verified ? "VERIFIED" : undefined,
    };

    if (categoryId) {
      where.categories = {
        some: {
          categoryId,
        },
      };
    }

    if (location) {
      where.location = {
        contains: location,
        mode: "insensitive",
      };
    }

    if (minRating) {
      where.rating = {
        gte: new Prisma.Decimal(minRating),
      };
    }

    if (maxHourlyRate) {
      where.hourlyRate = {
        lte: new Prisma.Decimal(maxHourlyRate),
      };
    }

    if (search) {
      where.OR = [
        {
          user: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          bio: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          specialties: {
            some: {
              specialty: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    const orderBy: Prisma.ProviderOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [items, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          specialties: {
            select: {
              specialty: true,
            },
          },
        },
      }),
      this.prisma.provider.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeaturedProviders(limit: number = 6) {
    return this.prisma.provider.findMany({
      where: {
        featured: true,
        isActive: true,
        deletedAt: null,
        verificationStatus: "VERIFIED",
      },
      take: limit,
      orderBy: { rating: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        categories: {
          where: { isPrimary: true },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  async updateRating(providerId: string) {
    const result = await this.prisma.review.aggregate({
      where: {
        providerId,
        isVisible: true,
        deletedAt: null,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return this.prisma.provider.update({
      where: { id: providerId },
      data: {
        rating: result._avg.rating || 0,
        reviewCount: result._count.rating,
      },
    });
  }

  /**
   * Recompute and persist the provider's composite trust score (Section 4.6.4)
   * from the counters already maintained on the record. Call this after any
   * input changes — a review is created/updated/moderated, or a booking is
   * completed, cancelled or flagged as a no-show.
   */
  async recomputeTrustScore(providerId: string) {
    const p = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        rating: true,
        reviewCount: true,
        completedBookings: true,
        totalBookings: true,
        noShowCount: true,
        responseRate: true,
        avgResponseTimeMinutes: true,
        verificationStatus: true,
        yearsExperience: true,
      },
    });
    if (!p) return null;

    const trustScore = computeTrustScore({
      averageRating: Number(p.rating),
      reviewCount: p.reviewCount,
      completedBookings: p.completedBookings,
      totalBookings: p.totalBookings,
      providerCancellations: p.noShowCount,
      responseRate: Number(p.responseRate),
      avgResponseTimeMinutes: p.avgResponseTimeMinutes,
      isVerified: p.verificationStatus === VerificationStatus.VERIFIED,
      yearsExperience: p.yearsExperience,
    });

    return this.prisma.provider.update({
      where: { id: providerId },
      data: { trustScore },
    });
  }

  async incrementBookingCount(providerId: string, completed: boolean = false) {
    const data: Prisma.ProviderUpdateInput = {
      totalBookings: { increment: 1 },
    };

    if (completed) {
      data.completedBookings = { increment: 1 };
    }

    return this.prisma.provider.update({
      where: { id: providerId },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.provider.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
