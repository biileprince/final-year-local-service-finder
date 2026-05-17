import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";
import {
  UserRole,
  BookingStatus,
  VerificationStatus,
  PaymentStatus,
} from "@prisma/client";

export interface DashboardStats {
  users: {
    total: number;
    customers: number;
    providers: number;
    admins: number;
    newThisMonth: number;
  };
  providers: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
    activeCount: number;
  };
  bookings: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    thisMonth: number;
    revenue: number;
  };
  reviews: {
    total: number;
    averageRating: number;
    reported: number;
  };
}

export interface UserListParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ProviderListParams {
  page?: number;
  limit?: number;
  verificationStatus?: VerificationStatus;
  search?: string;
  categoryId?: string;
}

export interface BookingListParams {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  startDate?: Date;
  endDate?: Date;
  providerId?: string;
  customerId?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  // ============================================================================
  // Dashboard & Analytics
  // ============================================================================

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      customerCount,
      providerCount,
      adminCount,
      newUsersThisMonth,
      totalProviders,
      verifiedProviders,
      pendingProviders,
      rejectedProviders,
      activeProviders,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      bookingsThisMonth,
      revenueResult,
      totalReviews,
      avgRatingResult,
      reportedReviews,
    ] = await Promise.all([
      // User stats
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { role: UserRole.CUSTOMER, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { role: UserRole.PROVIDER, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth }, deletedAt: null },
      }),

      // Provider stats
      this.prisma.provider.count({ where: { deletedAt: null } }),
      this.prisma.provider.count({
        where: {
          verificationStatus: VerificationStatus.VERIFIED,
          deletedAt: null,
        },
      }),
      this.prisma.provider.count({
        where: {
          verificationStatus: VerificationStatus.PENDING,
          deletedAt: null,
        },
      }),
      this.prisma.provider.count({
        where: {
          verificationStatus: VerificationStatus.REJECTED,
          deletedAt: null,
        },
      }),
      this.prisma.provider.count({
        where: { isActive: true, deletedAt: null },
      }),

      // Booking stats
      this.prisma.booking.count({ where: { deletedAt: null } }),
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CONFIRMED, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.COMPLETED, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CANCELLED, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: startOfMonth }, deletedAt: null },
      }),
      this.prisma.booking.aggregate({
        where: {
          status: BookingStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          deletedAt: null,
        },
        _sum: { finalAmount: true },
      }),

      // Review stats
      this.prisma.review.count({ where: { deletedAt: null } }),
      this.prisma.review.aggregate({
        where: { deletedAt: null },
        _avg: { rating: true },
      }),
      this.prisma.review.count({
        where: { isReported: true, deletedAt: null },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        customers: customerCount,
        providers: providerCount,
        admins: adminCount,
        newThisMonth: newUsersThisMonth,
      },
      providers: {
        total: totalProviders,
        verified: verifiedProviders,
        pending: pendingProviders,
        rejected: rejectedProviders,
        activeCount: activeProviders,
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        thisMonth: bookingsThisMonth,
        revenue: Number(revenueResult._sum.finalAmount) || 0,
      },
      reviews: {
        total: totalReviews,
        averageRating: avgRatingResult._avg.rating || 0,
        reported: reportedReviews,
      },
    };
  }

  async getRevenueAnalytics(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        createdAt: { gte: startDate },
        deletedAt: null,
      },
      select: {
        createdAt: true,
        finalAmount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by date
    const revenueByDate: Record<string, number> = {};
    bookings.forEach((booking) => {
      const date = booking.createdAt.toISOString().split("T")[0];
      revenueByDate[date] =
        (revenueByDate[date] || 0) + Number(booking.finalAmount);
    });

    return Object.entries(revenueByDate).map(([date, revenue]) => ({
      date,
      revenue,
    }));
  }

  // ============================================================================
  // User Management
  // ============================================================================

  async getUsers(params: UserListParams) {
    const {
      page = 1,
      limit = 20,
      role,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    // Don't filter on deletedAt here — the admin list should include suspended
    // users (suspension is modelled as a soft-delete on User) so they can be
    // reactivated. We expose `deletedAt` to the client and let the UI render
    // a "Suspended" badge for soft-deleted rows.
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          deletedAt: true,
          provider: {
            select: {
              id: true,
              verificationStatus: true,
              rating: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        provider: {
          include: {
            categories: { include: { category: true } },
            specialties: true,
          },
        },
        customerBookings: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { provider: { include: { user: true } } },
        },
        customerReviews: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateUserRole(id: string, role: UserRole, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role,
        updatedById: adminId,
      },
    });
  }

  async suspendUser(id: string, reason: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Soft delete the user
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: adminId,
      },
    });
  }

  async reactivateUser(id: string, adminId: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedById: adminId,
      },
    });
  }

  // ============================================================================
  // Provider Verification
  // ============================================================================

  async getPendingVerifications(params: ProviderListParams) {
    const { page = 1, limit = 20, search, categoryId } = params;

    const where: any = {
      verificationStatus: VerificationStatus.PENDING,
      deletedAt: null,
    };

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (categoryId) {
      where.categories = { some: { categoryId } };
    }

    const [providers, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
            },
          },
          categories: { include: { category: true } },
          idDocument: true,
          businessLicense: true,
        },
      }),
      this.prisma.provider.count({ where }),
    ]);

    return {
      providers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async verifyProvider(providerId: string, adminId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return this.prisma.provider.update({
      where: { id: providerId },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: adminId,
        isActive: true,
      },
    });
  }

  async rejectProvider(providerId: string, reason: string, adminId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return this.prisma.provider.update({
      where: { id: providerId },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        verifiedById: adminId,
      },
    });
  }

  // ============================================================================
  // Booking Management
  // ============================================================================

  async getBookings(params: BookingListParams) {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      providerId,
      customerId,
    } = params;

    const where: any = { deletedAt: null };

    if (status) where.status = status;
    if (providerId) where.providerId = providerId;
    if (customerId) where.customerId = customerId;

    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = startDate;
      if (endDate) where.scheduledDate.lte = endDate;
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          provider: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        provider: { include: { user: true } },
        review: true,
        attachments: { include: { file: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    return booking;
  }

  async cancelBooking(id: string, reason: string, adminId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException("Cannot cancel a completed booking");
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledById: adminId,
        statusChangedAt: new Date(),
        statusChangedById: adminId,
      },
    });
  }

  // ============================================================================
  // Review Moderation
  // ============================================================================

  async getReportedReviews(page: number = 1, limit: number = 20) {
    const where = { isReported: true, deletedAt: null };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          provider: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          booking: { select: { id: true, bookingNumber: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async moderateReview(
    reviewId: string,
    action: "approve" | "hide" | "delete",
    adminId: string,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    const updateData: any = {
      moderatedAt: new Date(),
      moderatedById: adminId,
      isReported: false,
    };

    switch (action) {
      case "approve":
        updateData.isVisible = true;
        break;
      case "hide":
        updateData.isVisible = false;
        break;
      case "delete":
        updateData.deletedAt = new Date();
        break;
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: updateData,
    });
  }

  // ============================================================================
  // Category Management
  // ============================================================================

  async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    imageId?: string;
    parentId?: string;
    displayOrder?: number;
  }) {
    // Check for duplicate slug
    const existing = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new BadRequestException("Category with this slug already exists");
    }

    const created = await this.prisma.category.create({
      data,
      include: {
        image: { select: { id: true, url: true, thumbnailUrl: true } },
      },
    });
    await this.cacheService.invalidateCategories();
    return created;
  }

  async updateCategory(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      icon: string;
      color: string;
      imageId: string | null;
      parentId: string;
      displayOrder: number;
      isActive: boolean;
    }>,
  ) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data,
      include: {
        image: { select: { id: true, url: true, thumbnailUrl: true } },
      },
    });
    await this.cacheService.invalidateCategories();
    return updated;
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { providers: true },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    if (category.providers.length > 0) {
      throw new BadRequestException(
        "Cannot delete category with associated providers",
      );
    }

    const deleted = await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.cacheService.invalidateCategories();
    return deleted;
  }

  // ============================================================================
  // System Health
  // ============================================================================

  async getSystemHealth() {
    const [dbStats, recentErrors, activeUsers] = await Promise.all([
      // Database stats
      this.prisma
        .$queryRaw`SELECT pg_database_size(current_database()) as db_size`,

      // Recent errors from logs
      this.prisma.applicationLog.count({
        where: {
          level: "ERROR",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),

      // Active users (logged in last 24 hours)
      this.prisma.user.count({
        where: {
          lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      database: {
        connected: true,
        size: dbStats,
      },
      errors: {
        last24Hours: recentErrors,
      },
      users: {
        activeLast24Hours: activeUsers,
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  async getAuditLogs(page: number = 1, limit: number = 50) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
