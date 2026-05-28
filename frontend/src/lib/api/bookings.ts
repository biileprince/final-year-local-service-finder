import { apiClient, buildQueryString } from "./client";
import type {
  Booking,
  BookingAttachment,
  BookingStatus,
  PaginatedResponse,
} from "@/types";

type BookingListResponse =
  | PaginatedResponse<Booking>
  | {
      items: Booking[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };

function normalizeBookingList(
  result: BookingListResponse,
): PaginatedResponse<Booking> {
  if (Array.isArray((result as PaginatedResponse<Booking>).data)) {
    return result as PaginatedResponse<Booking>;
  }

  const items = (result as { items?: Booking[] }).items ?? [];
  const total = (result as { total?: number }).total ?? items.length;
  const page = (result as { page?: number }).page ?? 1;
  const limit = (result as { limit?: number }).limit ?? (items.length || 1);
  const totalPages =
    (result as { totalPages?: number }).totalPages ??
    Math.max(1, Math.ceil(total / limit));

  return {
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

export interface CreateBookingDto {
  providerId: string;
  scheduledDate: string;
  // Optional. Omit when the customer wants the provider to confirm the time.
  scheduledStartTime?: string;
  serviceAddress: string;
  serviceLatitude?: number;
  serviceLongitude?: number;
  problemDescription: string;
  estimatedAmount?: number;
  attachmentIds?: string[];
}

export interface BookingsQueryParams {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}

export const bookingsService = {
  async getCustomerBookings(
    params?: BookingsQueryParams,
  ): Promise<PaginatedResponse<Booking>> {
    const queryString = buildQueryString(params || {});
    const result = await apiClient.get<BookingListResponse>(
      `/bookings/my-bookings${queryString}`,
      true,
    );
    return normalizeBookingList(result);
  },

  async getProviderBookings(
    providerId: string,
    params?: BookingsQueryParams,
  ): Promise<PaginatedResponse<Booking>> {
    const queryString = buildQueryString({ ...(params || {}), providerId });
    const result = await apiClient.get<BookingListResponse>(
      `/bookings/provider-bookings${queryString}`,
      true,
    );
    return normalizeBookingList(result);
  },

  async getById(id: string): Promise<Booking> {
    return apiClient.get<Booking>(`/bookings/${id}`, true);
  },

  async create(data: CreateBookingDto): Promise<Booking> {
    return apiClient.post<Booking>("/bookings", data, true);
  },

  async confirm(id: string, scheduledStartTime?: string): Promise<Booking> {
    return apiClient.put<Booking>(
      `/bookings/${id}/confirm`,
      scheduledStartTime ? { scheduledStartTime } : {},
      true,
    );
  },

  async start(id: string): Promise<Booking> {
    return apiClient.put<Booking>(`/bookings/${id}/start`, {}, true);
  },

  async complete(
    id: string,
    data?: { finalAmount?: number; serviceNotes?: string },
  ): Promise<Booking> {
    return apiClient.put<Booking>(
      `/bookings/${id}/complete`,
      data || {},
      true,
    );
  },

  async cancel(id: string, reason: string): Promise<Booking> {
    return apiClient.put<Booking>(`/bookings/${id}/cancel`, { reason }, true);
  },

  async flagNoShow(id: string, reason?: string): Promise<Booking> {
    return apiClient.put<Booking>(`/bookings/${id}/no-show`, { reason }, true);
  },

  async reschedule(
    id: string,
    data: { scheduledDate: string; scheduledStartTime?: string },
  ): Promise<Booking> {
    return apiClient.put<Booking>(`/bookings/${id}/reschedule`, data, true);
  },

  async getStats(providerId: string): Promise<Record<string, number>> {
    return apiClient.get(`/bookings/stats/${providerId}`, true);
  },

  async recordPayment(
    id: string,
    data: { paymentMethod: string; paymentReference: string },
  ): Promise<Booking> {
    return apiClient.put<Booking>(`/bookings/${id}/record-payment`, data, true);
  },

  async addAttachment(
    id: string,
    fileId: string,
    description?: string,
  ): Promise<BookingAttachment> {
    return apiClient.post<BookingAttachment>(
      `/bookings/${id}/attachments`,
      { fileId, description },
      true,
    );
  },

  async removeAttachment(id: string, attachmentId: string): Promise<void> {
    return apiClient.delete(`/bookings/${id}/attachments/${attachmentId}`, true);
  },

  // Get upcoming bookings for dashboard
  async getUpcoming(limit = 5): Promise<Booking[]> {
    const result = await this.getCustomerBookings({
      status: "CONFIRMED",
      limit,
    });
    return result.data;
  },
};
