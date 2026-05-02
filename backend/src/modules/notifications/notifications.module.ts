import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { EmailService } from "./services/email.service";
import { SmsService } from "./services/sms.service";

@Module({
  imports: [ConfigModule],
  providers: [
    NotificationsService,
    NotificationsRepository,
    EmailService,
    SmsService,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
