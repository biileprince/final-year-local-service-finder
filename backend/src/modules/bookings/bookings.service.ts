import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { MetricsService } from "../../monitoring/metrics.service";
import { CacheService } from "../../cache/cache.service";
import {
  BookingsRepository,
  CreateBookingData,
  UpdateBookingData,
  BookingListParams,
} from "./bookings.repository";
import { MessagesService } from "../messages/messages.service";
import { BookingStatus } from "@prisma/client";

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly messagesService: MessagesService,
  ) {}

  /**
   * Create a booking with atomic transaction
   * This ensures slot locking and booking creation happen together
   */
  async create(data: CreateBookingData) {
    const booking = await this.prisma.executeInTransaction(async (tx) => {
      // 1. Verify provider exists and is active
      const provider = await tx.provider.findUnique({
        where: { id: data.providerId },
        select: {
          id: true,
          isActive: true,
          verificationStatus: true,
          userId: true,
        },
      });

      if (!provider) {
        throw new NotFoundException("Provider not found");
      }

      if (!provider.isActive) {
        throw new BadRequestException("Provider is not currently accepting bookings");
      }

      // 2. Check for conflicting bookings
      const existingBooking = await tx.booking.findFirst({
        where: {
          providerId: data.providerId,
          scheduledDate: data.scheduledDate,
          scheduledStartTime: new Date(`1970-01-01T${data.scheduledStartTime}`),
          status: {
            notIn: ["CANCELLED"],
          },
          deletedAt: null,
        },
      });

      if (existingBooking) {
        throw new ConflictException("This time slot is already booked");
      }

      // 3. Check availability if it exists
      const availability = await tx.availability.findUnique({
        where: {
          providerId_date: {
            providerId: data.providerId,
            date: data.scheduledDate,
          },
        },
        include: {
          timeSlots: true,
        },
      });

      if (availability && !availability.isAvailable) {
        throw new BadRequestException("Provider is not available on this date");
      }

      // 4. Lock the time slot if it exists
      if (availability) {
        const timeSlot = availability.timeSlots.find(
          (slot) =>
            slot.startTime.toISOString().slice(11, 19) === data.scheduledStartTime &&
            slot.isAvailable,
        );

        if (timeSlot) {
          await tx.timeSlot.update({
            where: { id: timeSlot.id },
            data: { isAvailable: false },
          });
        }
      }

      // 5. Create the booking
      const bookingNumber = this.generateBookingNumber();
      const booking = await tx.booking.create({
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
          problemDescription: data.problemDescription,
          estimatedAmount: data.estimatedAmount,
          createdById: data.customerId,
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

      // 6. Update provider booking count
      await tx.provider.update({
        where: { id: data.providerId },
        data: {
          totalBookings: { increment: 1 },
        },
      });

      return booking;
    });

    // Auto-create a conversation linked to this booking so both the customer
    // and the provider discover each other in their messages list immediately.
    try {
      await this.messagesService.getOrCreateConversation(
        data.customerId,
        data.providerId,
        booking.id,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to create conversation for booking ${booking.bookingNumber}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return booking;
  }

  private generateBookingNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LSF-${timestamp}-${random}`;
  }

  async findById(id: string, userId?: string) {
    const booking = await this.bookingsRepository.findById(id);

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    // If userId provided, verify access
    if (userId) {
      const isCustomer = booking.customerId === userId;
      const isProvider = booking.provider.userId === userId;

      if (!isCustomer && !isProvider) {
        throw new ForbiddenException("Not authorized to view this booking");
      }
    }

    return booking;
  }

  async findByBookingNumber(bookingNumber: string) {
    const booking = await this.bookingsRepository.findByBookingNumber(bookingNumber);

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    return booking;
  }

  async update(id: string, userId: string, data: UpdateBookingData) {
    const booking = await this.findById(id);

    // Only customer can update booking details before confirmation
    if (booking.customerId !== userId) {
      throw new ForbiddenException("Not authorized to update this booking");
    }

    if (booking.status !== "PENDING") {
      throw new BadRequestException("Can only update pending bookings");
    }

    try {
      return await this.bookingsRepository.update(id, data, booking.version);
    } catch (error) {
      if (error.code === "P2025") {
        throw new ConflictException(
          "Booking was modified by another request. Please refresh and try again.",
        );
      }
      throw error;
    }
  }

  async confirm(id: string, userId: string) {
    const booking = await this.findById(id);

    // Only provider can confirm
    if (booking.provider.userId !== userId) {
      throw new ForbiddenException("Only the provider can confirm bookings");
    }

    if (booking.status !== "PENDING") {
      throw new BadRequestException("Can only confirm pending bookings");
    }

    const updated = await this.bookingsRepository.updateStatus(
      id,
      "CONFIRMED",
      userId,
      booking.version,
    );

    // Track metrics
    this.metricsService.bookingsCreated.inc({ status: "confirmed" });

    // Invalidate availability cache
    await this.cacheService.invalidateAvailability(
      booking.providerId,
      booking.scheduledDate.toISOString().split("T")[0],
    );

    this.logger.log(`Booking ${booking.bookingNumber} confirmed`);

    return updated;
  }

  async startService(id: string, userId: string) {
    const booking = await this.findById(id);

    if (booking.provider.userId !== userId) {
      throw new ForbiddenException("Only the provider can start the service");
    }

    if (booking.status !== "CONFIRMED") {
      throw new BadRequestException("Can only start confirmed bookings");
    }

    return this.bookingsRepository.updateStatus(
      id,
      "IN_PROGRESS",
      userId,
      booking.version,
      { actualStartTime: new Date() },
    );
  }

  async complete(id: string, userId: string, finalAmount?: number) {
    const booking = await this.findById(id);

    if (booking.provider.userId !== userId) {
      throw new ForbiddenException("Only the provider can complete bookings");
    }

    if (booking.status !== "IN_PROGRESS") {
      throw new BadRequestException("Can only complete in-progress bookings");
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Update booking
      const updated = await tx.booking.update({
        where: { id, version: booking.version },
        data: {
          status: "COMPLETED",
          statusChangedAt: new Date(),
          statusChangedById: userId,
          actualEndTime: new Date(),
          finalAmount: finalAmount,
          version: { increment: 1 },
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

      // Update provider completed bookings count
      await tx.provider.update({
        where: { id: booking.providerId },
        data: {
          completedBookings: { increment: 1 },
        },
      });

      // Track metrics
      this.metricsService.bookingsCreated.inc({ status: "completed" });

      this.logger.log(`Booking ${booking.bookingNumber} completed`);

      return updated;
    });
  }

  async cancel(id: string, userId: string, reason: string) {
    const booking = await this.findById(id);

    const isCustomer = booking.customerId === userId;
    const isProvider = booking.provider.userId === userId;

    if (!isCustomer && !isProvider) {
      throw new ForbiddenException("Not authorized to cancel this booking");
    }

    if (["COMPLETED", "CANCELLED"].includes(booking.status)) {
      throw new BadRequestException("Cannot cancel this booking");
    }

    const updated = await this.bookingsRepository.updateStatus(
      id,
      "CANCELLED",
      userId,
      booking.version,
      { cancellationReason: reason },
    );

    // Track metrics
    this.metricsService.bookingsCancelled.inc();

    // Invalidate availability cache to re-enable the slot
    await this.cacheService.invalidateAvailability(
      booking.providerId,
      booking.scheduledDate.toISOString().split("T")[0],
    );

    this.logger.log(`Booking ${booking.bookingNumber} cancelled by ${isCustomer ? "customer" : "provider"}`);

    return updated;
  }

  async getCustomerBookings(customerId: string, params: Partial<BookingListParams>) {
    return this.bookingsRepository.findMany({
      ...params,
      customerId,
    });
  }

  async getProviderBookings(providerId: string, params: Partial<BookingListParams>) {
    return this.bookingsRepository.findMany({
      ...params,
      providerId,
    });
  }

  async getBookingStats(providerId: string) {
    return this.bookingsRepository.getBookingStats(providerId);
  }

  async recordExternalPayment(
    id: string,
    userId: string,
    paymentData: {
      paymentMethod: string;
      paymentReference: string;
    },
  ) {
    const booking = await this.findById(id);

    // Only provider can record payment
    if (booking.provider.userId !== userId) {
      throw new ForbiddenException("Only the provider can record payment");
    }

    return this.bookingsRepository.updatePaymentStatus(id, "PAID", paymentData);
  }
}
