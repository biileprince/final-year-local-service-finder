import { Module } from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";
import { BookingsRepository } from "./bookings.repository";
import { RecurringBookingsService } from "./recurring-bookings.service";
import { RecurringBookingsController } from "./recurring-bookings.controller";
import { MessagesModule } from "../messages/messages.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProvidersModule } from "../providers/providers.module";

@Module({
  imports: [MessagesModule, NotificationsModule, ProvidersModule],
  providers: [BookingsService, BookingsRepository, RecurringBookingsService],
  controllers: [BookingsController, RecurringBookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
