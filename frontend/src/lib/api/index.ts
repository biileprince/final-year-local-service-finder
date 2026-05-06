// Export API client
export { apiClient, buildQueryString } from "./client";

// Export all services
export { authService } from "./auth";
export { categoriesService } from "./categories";
export { providersService } from "./providers";
export { bookingsService } from "./bookings";
export { messagesService } from "./messages";
export { notificationsService } from "./notifications";
export { reviewsService } from "./reviews";
export { availabilityService } from "./availability";
export { filesService, type FileContext, type UploadedFile } from "./files";
export { adminService } from "./admin";

// Re-export types from services
export type { LoginDto, RegisterDto } from "./auth";
export type { SearchProvidersParams, ProviderSearchResult } from "./providers";
export type { CreateBookingDto, BookingsQueryParams } from "./bookings";
export type { SendMessageDto } from "./messages";
export type { CreateReviewDto } from "./reviews";
export type {
  AvailabilityQueryParams,
  SetAvailabilityDto,
  RecurringAvailabilityDto,
} from "./availability";
