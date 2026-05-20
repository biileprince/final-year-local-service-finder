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
  /** Time string used to mark "customer didn't pick a slot" bookings. */
  private static readonly FLEXIBLE_TIME = "00:00:00";

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly messagesService: MessagesService,
  ) {}

  /**
   * Throws ConflictException if another non-cancelled booking already occupies
   * (providerId, scheduledDate, scheduledStartTime). Pass `excludeBookingId`
   * when rescheduling so the booking being moved doesn't collide with itself.
   * No-op for flexible-time bookings since the sentinel "00:00:00" is shared
   * by design.
   *
   * The `client` parameter is typed `any` because callers pass either the
   * top-level extended PrismaService or a `$transaction` tx client — Prisma's
   * generated types treat those as structurally incompatible despite both
   * exposing `booking.findFirst`. The shape is enforced by the call below.
   */
  private async assertSlotAvailable(
    client: any,
    providerId: string,
    scheduledDate: Date,
    scheduledStartTime: string,
    excludeBookingId?: string,
  ): Promise<void> {
    if (scheduledStartTime === BookingsService.FLEXIBLE_TIME) return;

    const conflict = await client.booking.findFirst({
      where: {
        providerId,
        scheduledDate,
        scheduledStartTime: new Date(`1970-01-01T${scheduledStartTime}`),
        status: { notIn: ["CANCELLED"] },
        deletedAt: null,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException("This time slot is already booked");
    }
  }

  /**
   * Create a booking with atomic transaction
   * This ensures slot locking and booking creation happen together
   */
  async create(data: CreateBookingData) {
    // Sentinel "00:00:00" represents a flexible-time booking — the customer
    // didn't pick a slot and the provider will confirm the time via messaging.
    const isFlexibleTime = !data.scheduledStartTime;
    const scheduledStartTime =
      data.scheduledStartTime ?? BookingsService.FLEXIBLE_TIME;

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

      // 2. Conflict detection only applies to fixed-time bookings.
      //    Flexible bookings won't collide on the sentinel time.
      if (!isFlexibleTime) {
        await this.assertSlotAvailable(
          tx,
          data.providerId,
          data.scheduledDate,
          scheduledStartTime,
        );
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

      // 4. Lock the time slot if it exists (skip for flexible bookings).
      if (availability && !isFlexibleTime) {
        const timeSlot = availability.timeSlots.find(
          (slot) =>
            slot.startTime.toISOString().slice(11, 19) === scheduledStartTime &&
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
          scheduledStartTime: new Date(`1970-01-01T${scheduledStartTime}`),
          scheduledEndTime: data.scheduledEndTime
            ? new Date(`1970-01-01T${data.scheduledEndTime}`)
            : null,
          serviceAddress: data.serviceAddress,
          problemDescription: data.problemDescription,
          estimatedAmount: data.estimatedAmount,
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

  async addAttachment(
    bookingId: string,
    userId: string,
    fileId: string,
    description?: string,
  ) {
    const booking = await this.findById(bookingId, userId);
    const isCustomer = booking.customerId === userId;
    const isProvider = booking.provider.userId === userId;
    if (!isCustomer && !isProvider) {
      throw new ForbiddenException(
        "Only the customer or provider can attach files to this booking",
      );
    }
    return this.prisma.bookingAttachment.create({
      data: {
        bookingId,
        fileId,
        attachmentType: isProvider ? "PROVIDER" : "CUSTOMER",
        description,
        uploadedById: userId,
      },
      include: {
        file: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  }

  async removeAttachment(
    bookingId: string,
    userId: string,
    attachmentId: string,
  ) {
    const attachment = await this.prisma.bookingAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, bookingId: true, uploadedById: true },
    });
    if (!attachment || attachment.bookingId !== bookingId) {
      throw new NotFoundException("Attachment not found");
    }
    if (attachment.uploadedById !== userId) {
      throw new ForbiddenException("You can only remove your own attachments");
    }
    await this.prisma.bookingAttachment.delete({ where: { id: attachmentId } });
    return { success: true };
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

  async confirm(id: string, userId: string, scheduledStartTime?: string) {
    const booking = await this.findById(id);

    // Only provider can confirm
    if (booking.provider.userId !== userId) {
      throw new ForbiddenException("Only the provider can confirm bookings");
    }

    if (booking.status !== "PENDING") {
      throw new BadRequestException("Can only confirm pending bookings");
    }

    // If the booking was created flexible (sentinel 00:00:00) and the provider
    // confirmed a concrete time via messaging, lock it in here.
    const isFlexibleSentinel =
      booking.scheduledStartTime?.toISOString().slice(11, 19) === "00:00:00";
    if (scheduledStartTime && isFlexibleSentinel) {
      await this.prisma.booking.update({
        where: { id, version: booking.version },
        data: {
          scheduledStartTime: new Date(`1970-01-01T${scheduledStartTime}`),
          version: { increment: 1 },
        },
      });
      booking.version += 1;
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

  async reschedule(
    id: string,
    userId: string,
    data: { scheduledDate: string; scheduledStartTime?: string },
  ) {
    const booking = await this.findById(id);

    const isCustomer = booking.customerId === userId;
    const isProvider = booking.provider.userId === userId;

    if (!isCustomer && !isProvider) {
      throw new ForbiddenException("Not authorized to reschedule this booking");
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      throw new BadRequestException(
        "Only pending or confirmed bookings can be rescheduled",
      );
    }

    // Guard against double-booking: previously `create` checked this but
    // `reschedule` didn't, so a provider could be moved into a slot another
    // booking already owned. We exclude the current booking from the check
    // since it's the one being moved.
    if (
      data.scheduledStartTime &&
      data.scheduledStartTime !== BookingsService.FLEXIBLE_TIME
    ) {
      await this.assertSlotAvailable(
        this.prisma,
        booking.providerId,
        new Date(data.scheduledDate),
        data.scheduledStartTime,
        id,
      );
    }

    // A reschedule by the customer pushes the booking back to PENDING so the
    // provider re-confirms; provider reschedules stay confirmed if already so.
    const updated = await this.bookingsRepository.update(
      id,
      {
        scheduledDate: new Date(data.scheduledDate),
        scheduledStartTime: data.scheduledStartTime,
      },
      booking.version,
    );

    if (isCustomer && booking.status === "CONFIRMED") {
      await this.bookingsRepository.updateStatus(
        id,
        "PENDING",
        userId,
        booking.version + 1,
      );
    }

    await this.cacheService.invalidateAvailability(
      booking.providerId,
      booking.scheduledDate.toISOString().split("T")[0],
    );
    await this.cacheService.invalidateAvailability(
      booking.providerId,
      data.scheduledDate,
    );

    this.logger.log(
      `Booking ${booking.bookingNumber} rescheduled by ${isCustomer ? "customer" : "provider"}`,
    );

    return updated;
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
