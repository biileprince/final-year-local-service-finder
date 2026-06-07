import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "@prisma/client";

export interface CreateReviewData {
  customerId: string;
  providerId: string;
  bookingId?: string;
  rating: number;
  title?: string;
  comment: string;
  imageIds?: string[];
}

export interface UpdateReviewData {
  rating?: number;
  title?: string;
  comment?: string;
}

export interface ReviewListParams {
  providerId?: string;
  customerId?: string;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
  sortBy?: "rating" | "createdAt" | "helpfulCount";
  sortOrder?: "asc" | "desc";
}

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateReviewData) {
    return this.prisma.review.create({
      data: {
        customerId: data.customerId,
        providerId: data.providerId,
        bookingId: data.bookingId,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        images:
          data.imageIds && data.imageIds.length > 0
            ? {
                create: data.imageIds.map((fileId, idx) => ({
                  fileId,
                  displayOrder: idx,
                })),
              }
            : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            scheduledDate: true,
          },
        },
        images: {
          include: {
            file: {
              select: { id: true, url: true, thumbnailUrl: true },
            },
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            scheduledDate: true,
          },
        },
        images: {
          include: {
            file: true,
          },
          orderBy: { displayOrder: "asc" },
        },
      },
    });
  }

  async findByBookingId(bookingId: string) {
    return this.prisma.review.findUnique({
      where: { bookingId },
    });
  }

  async findByCustomerAndProvider(customerId: string, providerId: string) {
    return this.prisma.review.findUnique({
      where: {
        customerId_providerId: {
          customerId,
          providerId,
        },
      },
    });
  }

  async update(id: string, data: UpdateReviewData) {
    return this.prisma.review.update({
      where: { id },
      data,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });
  }

  async addProviderResponse(id: string, response: string) {
    return this.prisma.review.update({
      where: { id },
      data: {
        providerResponse: response,
        providerRespondedAt: new Date(),
      },
    });
  }

  async findMany(params: ReviewListParams) {
    const {
      providerId,
      customerId,
      minRating,
      maxRating,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      isVisible: true,
      deletedAt: null,
    };

    if (providerId) where.providerId = providerId;
    if (customerId) where.customerId = customerId;

    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) where.rating.gte = minRating;
      if (maxRating) where.rating.lte = maxRating;
    }

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          images: {
            include: {
              file: {
                select: {
                  id: true,
                  url: true,
                  thumbnailUrl: true,
                },
              },
            },
            take: 3,
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProviderRatingStats(providerId: string) {
    const stats = await this.prisma.review.groupBy({
      by: ["rating"],
      where: {
        providerId,
        isVisible: true,
        deletedAt: null,
      },
      _count: { rating: true },
    });

    const aggregate = await this.prisma.review.aggregate({
      where: {
        providerId,
        isVisible: true,
        deletedAt: null,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const distribution = [1, 2, 3, 4, 5].map((rating) => {
      const found = stats.find((s) => s.rating === rating);
      return {
        rating,
        count: found?._count.rating || 0,
      };
    });

    return {
      averageRating: aggregate._avg.rating || 0,
      totalReviews: aggregate._count.rating,
      distribution,
    };
  }

  async incrementHelpfulCount(id: string) {
    return this.prisma.review.update({
      where: { id },
      data: {
        helpfulCount: { increment: 1 },
      },
    });
  }

  async reportReview(id: string, reason: string) {
    return this.prisma.review.update({
      where: { id },
      data: {
        isReported: true,
        reportReason: reason,
      },
    });
  }

  async moderateReview(id: string, moderatorId: string, isVisible: boolean) {
    return this.prisma.review.update({
      where: { id },
      data: {
        isVisible,
        moderatedAt: new Date(),
        moderatedById: moderatorId,
      },
    });
  }

  async softDelete(id: string) {
    return this.prisma.review.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
