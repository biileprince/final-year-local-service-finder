import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";

// Core modules
import { DatabaseModule } from "./database/database.module";
import { CacheModule } from "./cache/cache.module";
import { MonitoringModule } from "./monitoring/monitoring.module";

// Feature modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { HealthModule } from "./modules/health/health.module";
import { FilesModule } from "./modules/files/files.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 3,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 20,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core infrastructure
    DatabaseModule,
    CacheModule,
    MonitoringModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ProvidersModule,
    CategoriesModule,
    BookingsModule,
    ReviewsModule,
    AvailabilityModule,
    MessagesModule,
    HealthModule,
    FilesModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
