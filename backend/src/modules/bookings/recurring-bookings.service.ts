import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma, RecurrenceFrequency } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  NotificationsService,
  NotificationCategory,
  NotificationPriority,
} from "../notifications/notifications.service";
import { CreateRecurringBookingDto } from "./dto/create-recurring-booking.dto";

@Injectable()
export class RecurringBookingsService {
  private readonly logger = new Logger(RecurringBookingsService.name);

  /** How many days ahead we materialize the next instance of a series. */
  private static readonly LEAD_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSeries(customerId: string, dto: CreateRecurringBookingDto) {
    if (!dto.endDate && dto.maxOccurrences == null) {
      throw new BadRequestException(
        "Provide an end date or a maximum number of occurrences",
      );
    }

    const startDate = this.dateOnly(dto.startDate);
    const endDate = dto.endDate ? this.dateOnly(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException("End date must be after the start date");
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.providerId },
      select: { id: true, isActive: true },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    if (!provider.isActive) {
      throw new BadRequestException("Provider is not currently accepting bookings");
    }

    const series = await this.prisma.recurringBooking.create({
      data: {
        customerId,
        providerId: dto.providerId,
        frequency: dto.frequency,
        scheduledStartTime: dto.scheduledStartTime
          ? new Date(`1970-01-01T${dto.scheduledStartTime}`)
          : null,
        scheduledEndTime: dto.scheduledEndTime
          ? new Date(`1970-01-01T${dto.scheduledEndTime}`)
          : null,
        serviceAddress: dto.serviceAddress,
        serviceLatitude:
          dto.serviceLatitude != null
            ? new Prisma.Decimal(dto.serviceLatitude)
            : null,
        serviceLongitude:
          dto.serviceLongitude != null
            ? new Prisma.Decimal(dto.serviceLongitude)
            : null,
        problemDescription: dto.problemDescription,
        estimatedAmount:
          dto.estimatedAmount != null
            ? new Prisma.Decimal(dto.estimatedAmount)
            : null,
        startDate,
        endDate,
        maxOccurrences: dto.maxOccurrences ?? null,
        nextOccurrenceDate: startDate,
      },
    });

    // Materialize any instances already inside the lead window so the customer
    // sees the first booking immediately rather than waiting for the cron.
    await this.materialize(series.id);

    return this.findSeries(series.id, customerId);
  }

  async getCustomerSeries(customerId: string) {
    return this.prisma.recurringBooking.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: {
        provider: {
          include: { user: { select: { id: true, name: true } } },
        },
        _count: { select: { bookings: true } },
      },
    });
  }

  async findSeries(id: string, userId: string) {
    const series = await this.prisma.recurringBooking.findUnique({
      where: { id },
      include: {
        provider: {
          include: { user: { select: { id: true, name: true } } },
        },
        bookings: {
          orderBy: { scheduledDate: "asc" },
          select: {
            id: true,
            bookingNumber: true,
            scheduledDate: true,
            status: true,
          },
        },
      },
    });
    if (!series) throw new NotFoundException("Recurring booking not found");
    if (
      series.customerId !== userId &&
      series.provider.user.id !== userId
    ) {
      throw new ForbiddenException("Not authorized to view this series");
    }
    return series;
  }

  /** Stop a series. Already-generated bookings are left intact. */
  async cancelSeries(id: string, userId: string) {
    const series = await this.prisma.recurringBooking.findUnique({
      where: { id },
      include: { provider: { select: { userId: true } } },
    });
    if (!series) throw new NotFoundException("Recurring booking not found");
    if (series.customerId !== userId && series.provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to cancel this series");
    }

    return this.prisma.recurringBooking.update({
      where: { id },
      data: { isActive: false, nextOccurrenceDate: null },
    });
  }

  /**
   * Daily cron: materialize the next instance of every active series whose next
   * occurrence falls inside the lead window. Runs at 02:00 server time.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateDueInstances() {
    const horizon = this.horizon();
    const due = await this.prisma.recurringBooking.findMany({
      where: {
        isActive: true,
        nextOccurrenceDate: { not: null, lte: horizon },
      },
      select: { id: true },
    });

    this.logger.log(`Recurring booking sweep: ${due.length} series due`);
    for (const s of due) {
      try {
        await this.materialize(s.id);
      } catch (err) {
        this.logger.error(
          `Failed to materialize series ${s.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Create every instance of a series that is currently due (date within the
   * lead window), advancing the cursor and deactivating the series once its end
   * condition is reached.
   */
  private async materialize(seriesId: string) {
    const series = await this.prisma.recurringBooking.findUnique({
      where: { id: seriesId },
    });
    if (!series || !series.isActive || !series.nextOccurrenceDate) return;

    const horizon = this.horizon();
    let next: Date | null = series.nextOccurrenceDate;
    let created = series.occurrencesCreated;
    let active = true;

    while (next) {
      if (series.endDate && next > series.endDate) {
        active = false;
        next = null;
        break;
      }
      if (series.maxOccurrences != null && created >= series.maxOccurrences) {
        active = false;
        next = null;
        break;
      }
      // Not due yet — keep this cursor for a future sweep.
      if (next > horizon) break;

      await this.createInstance(series, next);
      created += 1;
      next = this.addInterval(next, series.frequency);
    }

    await this.prisma.recurringBooking.update({
      where: { id: series.id },
      data: {
        occurrencesCreated: created,
        nextOccurrenceDate: next,
        isActive: active,
      },
    });
  }

  private async createInstance(
    series: Prisma.RecurringBookingGetPayload<object>,
    date: Date,
  ) {
    const booking = await this.prisma.booking.create({
      data: {
        bookingNumber: this.generateBookingNumber(),
        customerId: series.customerId,
        providerId: series.providerId,
        scheduledDate: date,
        scheduledStartTime:
          series.scheduledStartTime ?? new Date("1970-01-01T00:00:00"),
        scheduledEndTime: series.scheduledEndTime,
        serviceAddress: series.serviceAddress,
        serviceLatitude: series.serviceLatitude,
        serviceLongitude: series.serviceLongitude,
        problemDescription: series.problemDescription,
        estimatedAmount: series.estimatedAmount,
        createdById: series.customerId,
        recurringBookingId: series.id,
      },
      include: {
        provider: {
          include: { user: { select: { id: true } } },
        },
      },
    });

    if (booking.provider?.user?.id) {
      this.notificationsService
        .send({
          userId: booking.provider.user.id,
          category: NotificationCategory.BOOKING_CONFIRMED,
          title: "New recurring booking",
          body: `A recurring booking (#${booking.bookingNumber}) was scheduled. Open it to confirm a time.`,
          referenceId: booking.id,
          priority: NotificationPriority.NORMAL,
          channels: ["in_app"],
        })
        .catch((err) =>
          this.logger.warn(
            `Recurring booking notification failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
    }

    return booking;
  }

  /** Advance a date by one recurrence interval (UTC). */
  private addInterval(date: Date, frequency: RecurrenceFrequency): Date {
    const d = new Date(date);
    if (frequency === "WEEKLY") {
      d.setUTCDate(d.getUTCDate() + 7);
    } else if (frequency === "BIWEEKLY") {
      d.setUTCDate(d.getUTCDate() + 14);
    } else {
      // MONTHLY — same day next month, clamped to the month's last day
      // (e.g. Jan 31 → Feb 28).
      const day = d.getUTCDate();
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const daysInNext = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
      return new Date(Date.UTC(year, month + 1, Math.min(day, daysInNext)));
    }
    return d;
  }

  /** Today (UTC midnight) + LEAD_DAYS, used as the generation cutoff. */
  private horizon(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + RecurringBookingsService.LEAD_DAYS);
    return d;
  }

  private dateOnly(value: string): Date {
    const d = new Date(value);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private generateBookingNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LSF-${timestamp}-${random}`;
  }
}
