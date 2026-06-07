import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, BookingStatus, PaymentStatus } from "@prisma/client";

export interface CreateBookingData {
  customerId: string;
  providerId: string;
  scheduledDate: Date;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  serviceAddress: string;
  serviceLatitude?: number;
  serviceLongitude?: number;
  problemDescription: string;
  estimatedAmount?: number;
  attachmentIds?: string[];
}

export interface UpdateBookingData {
  scheduledDate?: Date;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  serviceAddress?: string;
  problemDescription?: string;
  serviceNotes?: string;
  estimatedAmount?: number;
  finalAmount?: number;
}

export interface BookingListParams {
  customerId?: string;
  providerId?: string;
  status?: BookingStatus;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private generateBookingNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LSF-${timestamp}-${random}`;
  }

  async create(data: CreateBookingData) {
    const bookingNumber = this.generateBookingNumber();

    return this.prisma.booking.create({
      data: {
        bookingNumber,
        customerId: data.customerId,
        providerId: data.providerId,
        scheduledDate: data.scheduledDate,
        scheduledStartTime: new Date(`1970-01-01T${data.scheduledStartTime}`),
        scheduledEndTime: data.scheduledEndTime
          ? new Date(`1970-01-01T${data.scheduledEndTime}`)
          : null,
        serviceAddress: data.serviceAddress,
        serviceLatitude: data.serviceLatitude
          ? new Prisma.Decimal(data.serviceLatitude)
          : null,
        serviceLongitude: data.serviceLongitude
          ? new Prisma.Decimal(data.serviceLongitude)
          : null,
        problemDescription: data.problemDescription,
        estimatedAmount: data.estimatedAmount
          ? new Prisma.Decimal(data.estimatedAmount)
          : null,
        createdById: data.customerId,
        attachments:
          data.attachmentIds && data.attachmentIds.length > 0
            ? {
                create: data.attachmentIds.map((fileId) => ({
                  fileId,
                  attachmentType: "INITIAL",
                  uploadedById: data.customerId,
                })),
              }
            : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        provider: {
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
          },
        },
        review: {
          include: {
            images: {
              include: {
                file: {
                  select: { id: true, url: true, thumbnailUrl: true },
                },
              },
              orderBy: { displayOrder: "asc" },
            },
          },
        },
        attachments: {
          include: {
            file: true,
            uploadedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async findByBookingNumber(bookingNumber: string) {
    return this.prisma.booking.findUnique({
      where: { bookingNumber },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateBookingData, version: number) {
    const updateData: Prisma.BookingUpdateInput = {
      ...data,
      scheduledStartTime: data.scheduledStartTime
        ? new Date(`1970-01-01T${data.scheduledStartTime}`)
        : undefined,
      scheduledEndTime: data.scheduledEndTime
        ? new Date(`1970-01-01T${data.scheduledEndTime}`)
        : undefined,
      estimatedAmount: data.estimatedAmount
        ? new Prisma.Decimal(data.estimatedAmount)
        : undefined,
      finalAmount: data.finalAmount
        ? new Prisma.Decimal(data.finalAmount)
        : undefined,
      version: { increment: 1 },
    };

    return this.prisma.booking.update({
      where: { id, version },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    userId: string,
    version: number,
    additionalData?: {
      cancellationReason?: string;
      actualStartTime?: Date;
      actualEndTime?: Date;
    },
  ) {
    const data: Prisma.BookingUpdateInput = {
      status,
      statusChangedAt: new Date(),
      statusChangedBy: { connect: { id: userId } },
      version: { increment: 1 },
      ...additionalData,
    };

    if (status === "CANCELLED") {
      data.cancelledAt = new Date();
      data.cancelledBy = { connect: { id: userId } };
    }

    return this.prisma.booking.update({
      where: { id, version },
      data,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    paymentData?: {
      paymentMethod?: string;
      paymentReference?: string;
    },
  ) {
    const data: Prisma.BookingUpdateInput = {
      paymentStatus,
      ...paymentData,
    };

    if (paymentStatus === "PAID") {
      data.paidAt = new Date();
    }

    return this.prisma.booking.update({
      where: { id },
      data,
    });
  }

  async findMany(params: BookingListParams) {
    const {
      customerId,
      providerId,
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
    };

    if (customerId) where.customerId = customerId;
    if (providerId) where.providerId = providerId;
    if (status) where.status = status;

    if (fromDate || toDate) {
      where.scheduledDate = {};
      if (fromDate) where.scheduledDate.gte = fromDate;
      if (toDate) where.scheduledDate.lte = toDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
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
                  profileImage: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBookingStats(providerId: string) {
    const stats = await this.prisma.booking.groupBy({
      by: ["status"],
      where: { providerId, deletedAt: null },
      _count: { status: true },
    });

    return stats.reduce(
      (acc, curr) => {
        acc[curr.status.toLowerCase()] = curr._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async softDelete(id: string) {
    return this.prisma.booking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
