import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsGateway } from "./notifications.gateway";
import { EmailService } from "./services/email.service";
import { EmailTemplatesService } from "./services/email-templates.service";
import { SmsService } from "./services/sms.service";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsGateway,
    EmailService,
    EmailTemplatesService,
    SmsService,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, EmailService, SmsService],
})
export class NotificationsModule {}
