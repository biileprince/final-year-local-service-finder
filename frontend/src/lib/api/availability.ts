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
  // Get provider's availability
  getMyAvailability: async (
    params?: AvailabilityQueryParams,
  ): Promise<Availability[]> => {
    const query = params ? buildQueryString(params) : "";
    return apiClient.get<Availability[]>(`/availability/me${query}`);
  },

  // Get availability for a specific provider (public)
  getProviderAvailability: async (
    providerId: string,
    params?: AvailabilityQueryParams,
  ): Promise<Availability[]> => {
    const query = params ? buildQueryString(params) : "";
    return apiClient.get<Availability[]>(
      `/providers/${providerId}/availability${query}`,
    );
  },

  // Set availability for specific dates
  setAvailability: async (
    availabilities: SetAvailabilityDto[],
  ): Promise<Availability[]> => {
    return apiClient.post<Availability[]>("/availability", { availabilities });
  },

  // Add single availability
  addAvailability: async (data: SetAvailabilityDto): Promise<Availability> => {
    return apiClient.post<Availability>("/availability/single", data);
  },

  // Delete availability for a specific date
  deleteAvailability: async (date: string): Promise<void> => {
    return apiClient.delete(`/availability/${date}`);
  },

  // Get recurring availability settings
  getRecurringAvailability: async (): Promise<RecurringAvailabilityDto[]> => {
    return apiClient.get<RecurringAvailabilityDto[]>("/availability/recurring");
  },

  // Set recurring availability
  setRecurringAvailability: async (
    settings: RecurringAvailabilityDto[],
  ): Promise<RecurringAvailabilityDto[]> => {
    return apiClient.put<RecurringAvailabilityDto[]>(
      "/availability/recurring",
      {
        settings,
      },
    );
  },

  // Get available time slots for a specific date (for booking)
  getAvailableSlots: async (
    providerId: string,
    date: string,
  ): Promise<TimeSlot[]> => {
    return apiClient.get<TimeSlot[]>(
      `/providers/${providerId}/availability/${date}/slots`,
    );
  },

  // Block a time slot (e.g., for provider's personal time)
  blockTimeSlot: async (date: string, slotId: string): Promise<void> => {
    return apiClient.post(`/availability/${date}/slots/${slotId}/block`);
  },

  // Unblock a time slot
  unblockTimeSlot: async (date: string, slotId: string): Promise<void> => {
    return apiClient.post(`/availability/${date}/slots/${slotId}/unblock`);
  },
};
