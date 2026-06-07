import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { buildCalendar, IcalEvent } from "./ical.util";

interface BookingForIcs {
  id: string;
  bookingNumber: string;
  scheduledDate: Date;
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  status: string;
  serviceAddress: string;
  problemDescription: string;
  customerId: string;
  customer: { name: string };
  provider: { userId: string; user: { name: string } };
}

const BOOKING_SELECT = {
  id: true,
  bookingNumber: true,
  scheduledDate: true,
  scheduledStartTime: true,
  scheduledEndTime: true,
  status: true,
  serviceAddress: true,
  problemDescription: true,
  customerId: true,
  customer: { select: { name: true } },
  provider: { select: { userId: true, user: { select: { name: true } } } },
} as const;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public base URL of this backend, used to build the subscription link. */
  private get baseUrl(): string {
    return (process.env.BACKEND_URL ?? "http://localhost:3001").replace(
      /\/$/,
      "",
    );
  }

  async getFeed(userId: string): Promise<{ token: string; url: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { calendarToken: true },
    });
    if (!user) throw new NotFoundException("User not found");

    let token = user.calendarToken;
    if (!token) {
      token = randomBytes(24).toString("hex");
      await this.prisma.user.update({
        where: { id: userId },
        data: { calendarToken: token },
      });
    }
    return { token, url: `${this.baseUrl}/api/calendar/feed/${token}.ics` };
  }

  async resetFeed(userId: string): Promise<{ token: string; url: string }> {
    const token = randomBytes(24).toString("hex");
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: token },
    });
    return { token, url: `${this.baseUrl}/api/calendar/feed/${token}.ics` };
  }

  async getBookingIcs(
    bookingId: string,
    userId: string,
  ): Promise<{ filename: string; content: string }> {
    const booking = (await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: BOOKING_SELECT,
    })) as BookingForIcs | null;

    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.customerId !== userId && booking.provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to view this booking");
    }

    const event = this.toEvent(booking, userId);
    return {
      filename: `booking-${booking.bookingNumber}.ics`,
      content: buildCalendar([event], `Booking ${booking.bookingNumber}`),
    };
  }

  async getFeedIcs(token: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: token },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("Calendar feed not found");

    // Include this user's bookings (as customer or provider), excluding
    // cancelled ones and anything older than 30 days, so the feed stays small.
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);

    const bookings = (await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["CANCELLED"] },
        scheduledDate: { gte: cutoff },
        OR: [{ customerId: user.id }, { provider: { userId: user.id } }],
      },
      orderBy: { scheduledDate: "asc" },
      select: BOOKING_SELECT,
    })) as BookingForIcs[];

    const events = bookings.map((b) => this.toEvent(b, user.id));
    return buildCalendar(events, "My Service Bookings");
  }

  private toEvent(booking: BookingForIcs, viewerId: string): IcalEvent {
    const viewerIsCustomer = booking.customerId === viewerId;
    const counterpart = viewerIsCustomer
      ? booking.provider.user.name
      : booking.customer.name;
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      scheduledDate: booking.scheduledDate,
      scheduledStartTime: booking.scheduledStartTime,
      scheduledEndTime: booking.scheduledEndTime,
      status: booking.status,
      summary: `Service booking with ${counterpart}`,
      description: `${booking.problemDescription}\nBooking #${booking.bookingNumber}`,
      location: booking.serviceAddress,
    };
  }
}
