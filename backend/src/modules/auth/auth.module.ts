import { Module, Global } from "@nestjs/common";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { VerificationService } from "./verification.service";
import { OtpService } from "./otp.service";
import { UsersModule } from "../users/users.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Global()
@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
        } as JwtModuleOptions["signOptions"],
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, VerificationService, OtpService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, VerificationService, OtpService],
})
export class AuthModule {}
