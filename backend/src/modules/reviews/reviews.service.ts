import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { MetricsService } from "../../monitoring/metrics.service";
import {
  ReviewsRepository,
  CreateReviewData,
  UpdateReviewData,
  ReviewListParams,
} from "./reviews.repository";
import { ProvidersService } from "../providers/providers.service";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly reviewsRepository: ReviewsRepository,
    private readonly providersService: ProvidersService,
  ) {}

  async create(data: CreateReviewData) {
    // Check if booking exists and belongs to customer
    if (data.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: data.bookingId },
        select: {
          customerId: true,
          providerId: true,
          status: true,
          review: { select: { id: true } },
        },
      });

      if (!booking) {
        throw new NotFoundException("Booking not found");
      }

      if (booking.customerId !== data.customerId) {
        throw new ForbiddenException("Not authorized to review this booking");
      }

      if (booking.status !== "COMPLETED") {
        throw new BadRequestException("Can only review completed bookings");
      }

      if (booking.review) {
        throw new ConflictException("Review already exists for this booking");
      }

      // Ensure provider matches
      data.providerId = booking.providerId;
    }

    // Check if customer has already reviewed this provider
    const existingReview = await this.reviewsRepository.findByCustomerAndProvider(
      data.customerId,
      data.providerId,
    );

    if (existingReview) {
      throw new ConflictException("You have already reviewed this provider");
    }

    // Create review
    const review = await this.reviewsRepository.create(data);

    // Update provider rating
    await this.providersService.updateRating(data.providerId);

    // Track metrics
    this.metricsService.reviewsSubmitted.inc({ rating: data.rating.toString() });

    return review;
  }

  async findById(id: string) {
    const review = await this.reviewsRepository.findById(id);

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    return review;
  }

  async update(id: string, userId: string, data: UpdateReviewData) {
    const review = await this.findById(id);

    if (review.customerId !== userId) {
      throw new ForbiddenException("Not authorized to update this review");
    }

    const updated = await this.reviewsRepository.update(id, data);

    // Update provider rating if rating changed
    if (data.rating !== undefined) {
      await this.providersService.updateRating(review.providerId);
    }

    return updated;
  }

  async addProviderResponse(id: string, userId: string, response: string) {
    const review = await this.findById(id);

    // Verify user is the provider
    if (review.provider.userId !== userId) {
      throw new ForbiddenException("Only the provider can respond to reviews");
    }

    if (review.providerResponse) {
      throw new BadRequestException("Provider has already responded to this review");
    }

    return this.reviewsRepository.addProviderResponse(id, response);
  }

  async getProviderReviews(providerId: string, params: Partial<ReviewListParams>) {
    return this.reviewsRepository.findMany({
      ...params,
      providerId,
    });
  }

  async getCustomerReviews(customerId: string, params: Partial<ReviewListParams>) {
    return this.reviewsRepository.findMany({
      ...params,
      customerId,
    });
  }

  async getProviderRatingStats(providerId: string) {
    return this.reviewsRepository.getProviderRatingStats(providerId);
  }

  async markHelpful(id: string) {
    return this.reviewsRepository.incrementHelpfulCount(id);
  }

  async reportReview(id: string, userId: string, reason: string) {
    const review = await this.findById(id);

    // Can't report your own review
    if (review.customerId === userId) {
      throw new BadRequestException("Cannot report your own review");
    }

    return this.reviewsRepository.reportReview(id, reason);
  }

  async moderateReview(id: string, moderatorId: string, isVisible: boolean) {
    const updated = await this.reviewsRepository.moderateReview(
      id,
      moderatorId,
      isVisible,
    );

    // Update provider rating
    await this.providersService.updateRating(updated.providerId);

    return updated;
  }

  async delete(id: string, userId: string) {
    const review = await this.findById(id);

    if (review.customerId !== userId) {
      throw new ForbiddenException("Not authorized to delete this review");
    }

    await this.reviewsRepository.softDelete(id);

    // Update provider rating
    await this.providersService.updateRating(review.providerId);

    return { message: "Review deleted successfully" };
  }
}
