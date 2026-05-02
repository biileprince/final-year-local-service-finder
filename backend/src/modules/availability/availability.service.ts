import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";
import {
  AvailabilityRepository,
  CreateAvailabilityData,
  UpdateAvailabilityData,
} from "./availability.repository";

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly availabilityRepository: AvailabilityRepository,
  ) {}

  async setAvailability(
    providerId: string,
    userId: string,
    data: Omit<CreateAvailabilityData, "providerId">,
  ) {
    // Verify provider ownership
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized to set availability for this provider");
    }

    const availability = await this.availabilityRepository.upsert({
      ...data,
      providerId,
    });

    // Invalidate cache
    const dateStr = data.date.toISOString().split("T")[0];
    await this.cacheService.invalidateAvailability(providerId, dateStr);

    return availability;
  }

  async getAvailability(providerId: string, date: Date) {
    const dateStr = date.toISOString().split("T")[0];

    // Try cache first
    const cached = await this.cacheService.getAvailability(providerId, dateStr);
    if (cached) {
      return cached;
    }

    const availability = await this.availabilityRepository.findByProviderAndDate(
      providerId,
      date,
    );

    if (availability) {
      await this.cacheService.setAvailability(providerId, dateStr, availability);
    }

    return availability;
  }

  async getAvailabilityRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.availabilityRepository.findByProviderAndDateRange(
      providerId,
      startDate,
      endDate,
    );
  }

  async getAvailableSlots(providerId: string, date: Date) {
    return this.availabilityRepository.getAvailableSlots(providerId, date);
  }

  async updateAvailability(
    providerId: string,
    userId: string,
    date: Date,
    data: UpdateAvailabilityData,
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized");
    }

    const availability = await this.availabilityRepository.findByProviderAndDate(
      providerId,
      date,
    );

    if (!availability) {
      throw new NotFoundException("Availability not found for this date");
    }

    const updated = await this.availabilityRepository.update(availability.id, data);

    // Invalidate cache
    const dateStr = date.toISOString().split("T")[0];
    await this.cacheService.invalidateAvailability(providerId, dateStr);

    return updated;
  }

  async setTimeSlots(
    providerId: string,
    userId: string,
    date: Date,
    slots: { startTime: string; endTime: string; isAvailable?: boolean }[],
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized");
    }

    // Get or create availability
    let availability = await this.availabilityRepository.findByProviderAndDate(
      providerId,
      date,
    );

    if (!availability) {
      availability = await this.availabilityRepository.create({
        providerId,
        date,
        isAvailable: true,
      });
    }

    // Delete existing time slots
    await this.availabilityRepository.deleteTimeSlotsByAvailability(availability.id);

    // Create new time slots
    if (slots.length > 0) {
      await this.availabilityRepository.createTimeSlots(availability.id, slots);
    }

    // Fetch updated availability
    const updated = await this.availabilityRepository.findByProviderAndDate(
      providerId,
      date,
    );

    // Invalidate cache
    const dateStr = date.toISOString().split("T")[0];
    await this.cacheService.invalidateAvailability(providerId, dateStr);

    return updated;
  }

  async generateDefaultSlots(
    providerId: string,
    userId: string,
    date: Date,
    startHour: number = 8,
    endHour: number = 17,
    slotDurationMinutes: number = 60,
  ) {
    const slots: { startTime: string; endTime: string }[] = [];

    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, "0")}:00:00`;
      const endMinutes = slotDurationMinutes;
      const endHourCalc = hour + Math.floor(endMinutes / 60);
      const endMinutesCalc = endMinutes % 60;
      const endTime = `${endHourCalc.toString().padStart(2, "0")}:${endMinutesCalc.toString().padStart(2, "0")}:00`;

      slots.push({ startTime, endTime });
    }

    return this.setTimeSlots(providerId, userId, date, slots);
  }

  async bulkSetAvailability(
    providerId: string,
    userId: string,
    dates: Date[],
    isAvailable: boolean,
    slots?: { startTime: string; endTime: string }[],
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized");
    }

    const results = [];

    for (const date of dates) {
      const availability = await this.availabilityRepository.upsert({
        providerId,
        date,
        isAvailable,
        timeSlots: slots,
      });
      results.push(availability);

      // Invalidate cache for each date
      const dateStr = date.toISOString().split("T")[0];
      await this.cacheService.invalidateAvailability(providerId, dateStr);
    }

    return results;
  }

  async deleteAvailability(providerId: string, userId: string, date: Date) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { userId: true },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    if (provider.userId !== userId) {
      throw new ForbiddenException("Not authorized");
    }

    const availability = await this.availabilityRepository.findByProviderAndDate(
      providerId,
      date,
    );

    if (!availability) {
      throw new NotFoundException("Availability not found");
    }

    await this.availabilityRepository.delete(availability.id);

    // Invalidate cache
    const dateStr = date.toISOString().split("T")[0];
    await this.cacheService.invalidateAvailability(providerId, dateStr);

    return { message: "Availability deleted successfully" };
  }
}
