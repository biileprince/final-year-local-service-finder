import { apiClient, buildQueryString } from "./client";
import type { Availability, TimeSlot } from "@/types";

export interface AvailabilityQueryParams {
  startDate?: string;
  endDate?: string;
}

export interface SetAvailabilityDto {
  date: string;
  timeSlots: {
    startTime: string;
    endTime: string;
  }[];
}

export interface RecurringAvailabilityDto {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  timeSlots: {
    startTime: string;
    endTime: string;
  }[];
}

export const availabilityService = {
  // Get current provider's availability (authenticated)
  getMyAvailability: async (
    params?: AvailabilityQueryParams,
  ): Promise<Availability[]> => {
    const query = params ? buildQueryString(params) : "";
    return apiClient.get<Availability[]>(`/availability/me${query}`, true);
  },

  // Get availability for a specific provider (public range endpoint)
  getProviderAvailability: async (
    providerId: string,
    params?: AvailabilityQueryParams,
  ): Promise<Availability[]> => {
    const query = params
      ? buildQueryString({
          startDate: params.startDate,
          endDate: params.endDate,
        })
      : "";
    return apiClient.get<Availability[]>(
      `/availability/${providerId}/range${query}`,
    );
  },

  // Bulk-set the current provider's availability
  setAvailability: async (
    availabilities: SetAvailabilityDto[],
  ): Promise<Availability[]> => {
    return apiClient.post<Availability[]>(
      "/availability",
      { availabilities },
      true,
    );
  },

  // Get available time slots for a specific date (for booking — public)
  getAvailableSlots: async (
    providerId: string,
    date: string,
  ): Promise<TimeSlot[]> => {
    const query = buildQueryString({ date });
    return apiClient.get<TimeSlot[]>(
      `/availability/${providerId}/slots${query}`,
    );
  },
};
