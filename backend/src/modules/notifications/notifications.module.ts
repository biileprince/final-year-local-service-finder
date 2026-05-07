import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { EmailService } from "./services/email.service";
import { EmailTemplatesService } from "./services/email-templates.service";
import { SmsService } from "./services/sms.service";

@Module({
  imports: [ConfigModule],
  providers: [
    NotificationsService,
    NotificationsRepository,
    EmailService,
    EmailTemplatesService,
    SmsService,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, EmailService, SmsService],
})
export class NotificationsModule {}
