import { apiClient, buildQueryString } from "./client";
import type { Booking, BookingStatus, PaginatedResponse } from "@/types";

export interface CreateBookingDto {
  providerId: string;
  scheduledDate: string;
  scheduledStartTime: string;
  serviceAddress: string;
  problemDescription: string;
  estimatedAmount?: number;
}

export interface BookingsQueryParams {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}

export const bookingsService = {
  async getCustomerBookings(params?: BookingsQueryParams): Promise<PaginatedResponse<Booking>> {
    const queryString = buildQueryString(params || {});
    return apiClient.get<PaginatedResponse<Booking>>(`/bookings/customer${queryString}`, true);
  },

  async getProviderBookings(params?: BookingsQueryParams): Promise<PaginatedResponse<Booking>> {
    const queryString = buildQueryString(params || {});
    return apiClient.get<PaginatedResponse<Booking>>(`/bookings/provider${queryString}`, true);
  },

  async getById(id: string): Promise<Booking> {
    return apiClient.get<Booking>(`/bookings/${id}`, true);
  },

  async create(data: CreateBookingDto): Promise<Booking> {
    return apiClient.post<Booking>("/bookings", data, true);
  },

  async confirm(id: string): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${id}/confirm`, {}, true);
  },

  async start(id: string): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${id}/start`, {}, true);
  },

  async complete(id: string, data?: { finalAmount?: number; serviceNotes?: string }): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${id}/complete`, data || {}, true);
  },

  async cancel(id: string, reason: string): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${id}/cancel`, { reason }, true);
  },

  async reschedule(id: string, data: { scheduledDate: string; scheduledStartTime: string }): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${id}/reschedule`, data, true);
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
