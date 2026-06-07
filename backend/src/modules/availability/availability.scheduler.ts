import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../database/prisma.service";
import { AvailabilityRepository } from "./availability.repository";
import { CacheService } from "../../cache/cache.service";

const WEEKS_AHEAD = 6;

/** Converts minutes-since-midnight to an HH:MM:SS string. */
function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}

@Injectable()
export class AvailabilityScheduler {
  private readonly logger = new Logger(AvailabilityScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly cacheService: CacheService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async rollForward(): Promise<void> {
    this.logger.log("Starting availability roll-forward");

    const horizon = new Date();
    horizon.setDate(horizon.getDate() + WEEKS_AHEAD * 7);

    // Fetch every active provider that has business hours configured
    const providers = await this.prisma.provider.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, hours: true },
    });

    let created = 0;
    let skipped = 0;

    for (const provider of providers) {
      if (provider.hours.length === 0) {
        skipped++;
        continue;
      }

      const hoursByDay = new Map(
        provider.hours.map((h) => [h.dayOfWeek, h]),
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let d = new Date(today); d <= horizon; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const hourConfig = hoursByDay.get(dayOfWeek);

        if (!hourConfig || hourConfig.isClosed) continue;

        const dateSnap = new Date(d);

        // Skip if already exists
        const existing = await this.availabilityRepository.findByProviderAndDate(
          provider.id,
          dateSnap,
        );
        if (existing) continue;

        // Build hourly slots between openMinutes and closeMinutes
        const slots: { startTime: string; endTime: string; isAvailable: boolean }[] = [];
        for (
          let m = hourConfig.openMinutes;
          m + 60 <= hourConfig.closeMinutes;
          m += 60
        ) {
          slots.push({
            startTime: minutesToTimeString(m),
            endTime: minutesToTimeString(m + 60),
            isAvailable: true,
          });
        }

        await this.availabilityRepository.create({
          providerId: provider.id,
          date: dateSnap,
          isAvailable: true,
          timeSlots: slots,
        });

        const dateStr = dateSnap.toISOString().split("T")[0] as string;
        await this.cacheService.invalidateAvailability(provider.id, dateStr);
        created++;
      }
    }

    this.logger.log(
      `Roll-forward complete — ${created} days created, ${skipped} providers skipped (no hours)`,
    );
  }
}
