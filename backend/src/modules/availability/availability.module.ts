import { Module } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityRepository } from "./availability.repository";
import { AvailabilityScheduler } from "./availability.scheduler";

@Module({
  providers: [AvailabilityService, AvailabilityRepository, AvailabilityScheduler],
  controllers: [AvailabilityController],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
