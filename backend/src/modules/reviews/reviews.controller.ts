import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { ProviderResponseDto } from "./dto/provider-response.dto";
import { ReportReviewDto } from "./dto/report-review.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Public } from "../../common/decorators/public.decorator";
import { Roles, UserRole } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("reviews")
@ApiTags("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a review" })
  @ApiResponse({ status: 201, description: "Review created successfully" })
  @ApiResponse({ status: 409, description: "Review already exists" })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.create({
      ...createReviewDto,
      customerId: user.id,
    });
  }

  @Get("provider/:providerId")
  @Public()
  @ApiOperation({ summary: "Get reviews for a provider" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["rating", "createdAt", "helpfulCount"],
  })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  async getProviderReviews(
    @Param("providerId") providerId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("sortBy") sortBy?: "rating" | "createdAt" | "helpfulCount",
    @Query("sortOrder") sortOrder?: "asc" | "desc",
  ) {
    return this.reviewsService.getProviderReviews(providerId, {
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Get("provider/:providerId/stats")
  @Public()
  @ApiOperation({ summary: "Get rating statistics for a provider" })
  async getProviderStats(@Param("providerId") providerId: string) {
    return this.reviewsService.getProviderRatingStats(providerId);
  }

  @Get("my-reviews")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user reviews" })
  async getMyReviews(
    @CurrentUser() user: CurrentUserPayload,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.reviewsService.getCustomerReviews(user.id, { page, limit });
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Get review by ID" })
  @ApiResponse({ status: 200, description: "Returns review details" })
  @ApiResponse({ status: 404, description: "Review not found" })
  async findOne(@Param("id") id: string) {
    return this.reviewsService.findById(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a review" })
  @ApiResponse({ status: 200, description: "Review updated successfully" })
  async update(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(id, user.id, updateReviewDto);
  }

  @Post(":id/response")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add provider response to review" })
  async addProviderResponse(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ProviderResponseDto,
  ) {
    return this.reviewsService.addProviderResponse(id, user.id, dto.response);
  }

  @Post(":id/helpful")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mark review as helpful" })
  async markHelpful(@Param("id") id: string) {
    return this.reviewsService.markHelpful(id);
  }

  @Post(":id/report")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Report a review" })
  async reportReview(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviewsService.reportReview(id, user.id, dto.reason);
  }

  @Put(":id/moderate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Moderate a review (Admin only)" })
  async moderateReview(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body("isVisible") isVisible: boolean,
  ) {
    return this.reviewsService.moderateReview(id, user.id, isVisible);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a review" })
  async delete(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviewsService.delete(id, user.id);
  }
}
