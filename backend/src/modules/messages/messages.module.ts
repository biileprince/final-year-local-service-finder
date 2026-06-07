import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MessagesService } from "./messages.service";
import { MessagesGateway } from "./messages.gateway";
import { MessagesController } from "./messages.controller";
import { MessagesRepository } from "./messages.repository";
import { ModerationModule } from "../moderation/moderation.module";

@Module({
  imports: [
    ModerationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MessagesService, MessagesGateway, MessagesRepository],
  controllers: [MessagesController],
  exports: [MessagesService, MessagesGateway],
})
export class MessagesModule {}
