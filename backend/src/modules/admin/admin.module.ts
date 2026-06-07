import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { UsersModule } from "../users/users.module";
import { ProvidersModule } from "../providers/providers.module";
import { BookingsModule } from "../bookings/bookings.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { CategoriesModule } from "../categories/categories.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ModerationModule } from "../moderation/moderation.module";

@Module({
  imports: [
    UsersModule,
    ProvidersModule,
    BookingsModule,
    ReviewsModule,
    CategoriesModule,
    NotificationsModule,
    ModerationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
