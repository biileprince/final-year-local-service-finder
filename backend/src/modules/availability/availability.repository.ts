import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

export interface CreateAvailabilityData {
  providerId: string;
  date: Date;
  isAvailable?: boolean;
  notes?: string;
  timeSlots?: {
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
  }[];
}

export interface UpdateAvailabilityData {
  isAvailable?: boolean;
  notes?: string;
}

export interface CreateTimeSlotData {
  availabilityId: string;
  startTime: string;
  endTime: string;
  isAvailable?: boolean;
}

@Injectable()
export class AvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAvailabilityData) {
    const { timeSlots, ...availabilityData } = data;

    return this.prisma.availability.create({
      data: {
        ...availabilityData,
        timeSlots: timeSlots
          ? {
              create: timeSlots.map((slot) => ({
                startTime: new Date(`1970-01-01T${slot.startTime}`),
                endTime: new Date(`1970-01-01T${slot.endTime}`),
                isAvailable: slot.isAvailable ?? true,
              })),
            }
          : undefined,
      },
      include: {
        timeSlots: {
          orderBy: { startTime: "asc" },
        },
      },
    });
  }

  async findByProviderAndDate(providerId: string, date: Date) {
    return this.prisma.availability.findUnique({
      where: {
        providerId_date: {
          providerId,
          date,
        },
      },
      include: {
        timeSlots: {
          orderBy: { startTime: "asc" },
        },
      },
    });
  }

  async findByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.availability.findMany({
      where: {
        providerId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        timeSlots: {
          orderBy: { startTime: "asc" },
        },
      },
      orderBy: { date: "asc" },
    });
  }

  async update(id: string, data: UpdateAvailabilityData) {
    return this.prisma.availability.update({
      where: { id },
      data,
      include: {
        timeSlots: {
          orderBy: { startTime: "asc" },
        },
      },
    });
  }

  async upsert(data: CreateAvailabilityData) {
    const { timeSlots, ...availabilityData } = data;

    return this.prisma.availability.upsert({
      where: {
        providerId_date: {
          providerId: data.providerId,
          date: data.date,
        },
      },
      create: {
        ...availabilityData,
        timeSlots: timeSlots
          ? {
              create: timeSlots.map((slot) => ({
                startTime: new Date(`1970-01-01T${slot.startTime}`),
                endTime: new Date(`1970-01-01T${slot.endTime}`),
                isAvailable: slot.isAvailable ?? true,
              })),
            }
          : undefined,
      },
      update: {
        isAvailable: availabilityData.isAvailable,
        notes: availabilityData.notes,
      },
      include: {
        timeSlots: {
          orderBy: { startTime: "asc" },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.availability.delete({
      where: { id },
    });
  }

  // Time Slot Operations
  async createTimeSlot(data: CreateTimeSlotData) {
    return this.prisma.timeSlot.create({
      data: {
        availabilityId: data.availabilityId,
        startTime: new Date(`1970-01-01T${data.startTime}`),
        endTime: new Date(`1970-01-01T${data.endTime}`),
        isAvailable: data.isAvailable ?? true,
      },
    });
  }

  async createTimeSlots(
    availabilityId: string,
    slots: Omit<CreateTimeSlotData, "availabilityId">[],
  ) {
    return this.prisma.timeSlot.createMany({
      data: slots.map((slot) => ({
        availabilityId,
        startTime: new Date(`1970-01-01T${slot.startTime}`),
        endTime: new Date(`1970-01-01T${slot.endTime}`),
        isAvailable: slot.isAvailable ?? true,
      })),
    });
  }

  async updateTimeSlot(
    id: string,
    data: { isAvailable?: boolean; bookingId?: string | null },
  ) {
    return this.prisma.timeSlot.update({
      where: { id },
      data,
    });
  }

  async deleteTimeSlot(id: string) {
    return this.prisma.timeSlot.delete({
      where: { id },
    });
  }

  async deleteTimeSlotsByAvailability(availabilityId: string) {
    return this.prisma.timeSlot.deleteMany({
      where: { availabilityId },
    });
  }

  async getAvailableSlots(providerId: string, date: Date) {
    const availability = await this.findByProviderAndDate(providerId, date);

    if (!availability || !availability.isAvailable) {
      return [];
    }

    return availability.timeSlots.filter((slot) => slot.isAvailable);
  }
}
