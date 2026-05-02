import { Module, forwardRef } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsRepository } from "./reviews.repository";
import { ProvidersModule } from "../providers/providers.module";

@Module({
  imports: [forwardRef(() => ProvidersModule)],
  providers: [ReviewsService, ReviewsRepository],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
