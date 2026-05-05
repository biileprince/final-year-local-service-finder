"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAuth, useRequireRole } from "@/hooks";
import { availabilityService } from "@/lib/api";
import type { Availability, TimeSlot } from "@/types";
import { formatDate, cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

export default function AvailabilityPage() {
  useRequireRole(["PROVIDER"]);
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    return start;
  });
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string[]>>(
    {},
  );
  const [viewMode, setViewMode] = useState<"week" | "recurring">("week");

  useEffect(() => {
    loadAvailability();
  }, [currentWeekStart]);

  const loadAvailability = async () => {
    setIsLoading(true);
    try {
      const endDate = new Date(currentWeekStart);
      endDate.setDate(endDate.getDate() + 6);

      const data = await availabilityService.getMyAvailability({
        startDate: currentWeekStart.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      });
      setAvailabilities(data);

      // Initialize selected slots from availability data
      const slots: Record<string, string[]> = {};
      data.forEach((avail) => {
        const dateKey = avail.date;
        slots[dateKey] = avail.timeSlots
          .filter((ts) => ts.isAvailable)
          .map((ts) => ts.startTime);
      });
      setSelectedSlots(slots);
    } catch (error) {
      console.error("Failed to load availability:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
      return newDate;
    });
  };

  const toggleSlot = (dateKey: string, time: string) => {
    setSelectedSlots((prev) => {
      const currentSlots = prev[dateKey] || [];
      const newSlots = currentSlots.includes(time)
        ? currentSlots.filter((t) => t !== time)
        : [...currentSlots, time].sort();

      return { ...prev, [dateKey]: newSlots };
    });
  };

  const selectAllForDay = (dateKey: string) => {
    setSelectedSlots((prev) => ({
      ...prev,
      [dateKey]: [...TIME_SLOTS],
    }));
  };

  const clearAllForDay = (dateKey: string) => {
    setSelectedSlots((prev) => ({
      ...prev,
      [dateKey]: [],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert selected slots to availability data
      const availabilityData = Object.entries(selectedSlots).map(
        ([date, times]) => ({
          date,
          timeSlots: times.map((time) => ({
            startTime: time,
            endTime: `${parseInt(time.split(":")[0] ?? "0") + 1}:00`,
          })),
        }),
      );

      await availabilityService.setAvailability(availabilityData);
      loadAvailability();
    } catch (error) {
      console.error("Failed to save availability:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Availability
          </h1>
          <p className="mt-1 text-secondary-600">
            Set your available times for customers to book
          </p>
        </div>
        <Button onClick={handleSave} isLoading={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("week")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            viewMode === "week"
              ? "bg-primary-600 text-white"
              : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200",
          )}
        >
          Weekly View
        </button>
        <button
          onClick={() => setViewMode("recurring")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            viewMode === "recurring"
              ? "bg-primary-600 text-white"
              : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200",
          )}
        >
          Recurring Schedule
        </button>
      </div>

      {viewMode === "week" ? (
        <>
          {/* Week Navigation */}
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek("prev")}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <div className="text-center">
                <p className="font-semibold text-secondary-900">
                  {formatDate(weekDates[0]!.toISOString())} -{" "}
                  {formatDate(weekDates[6]!.toISOString())}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek("next")}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Weekly Calendar */}
          <div className="grid gap-4 lg:grid-cols-7">
            {weekDates.map((date) => {
              const dateKey = date.toISOString().split("T")[0] ?? "";
              const isToday = new Date().toDateString() === date.toDateString();
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
              const daySlots = selectedSlots[dateKey] || [];

              return (
                <Card key={dateKey} className={cn(isPast && "opacity-50")}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <div
                        className={cn(
                          "text-center",
                          isToday && "text-primary-600",
                        )}
                      >
                        <p className="text-xs font-normal text-secondary-500">
                          {DAYS_OF_WEEK[date.getDay()]}
                        </p>
                        <p className="text-lg font-bold">{date.getDate()}</p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => selectAllForDay(dateKey)}
                        disabled={isPast}
                      >
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => clearAllForDay(dateKey)}
                        disabled={isPast}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {TIME_SLOTS.map((time) => {
                        const isSelected = daySlots.includes(time);
                        return (
                          <button
                            key={time}
                            onClick={() => toggleSlot(dateKey, time)}
                            disabled={isPast}
                            className={cn(
                              "w-full rounded px-2 py-1 text-xs font-medium transition-colors",
                              isSelected
                                ? "bg-primary-600 text-white"
                                : "bg-secondary-100 text-secondary-600 hover:bg-secondary-200",
                              isPast && "cursor-not-allowed",
                            )}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        /* Recurring Schedule */
        <Card>
          <CardHeader>
            <CardTitle>Recurring Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-secondary-600">
              Set your default weekly availability. This will be applied to
              future weeks.
            </p>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day, index) => (
                <div
                  key={day}
                  className="flex items-center gap-4 rounded-lg border border-secondary-200 p-4"
                >
                  <div className="w-24 font-medium text-secondary-900">
                    {day}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        className="rounded bg-secondary-100 px-2 py-1 text-xs font-medium text-secondary-600 hover:bg-primary-100 hover:text-primary-700"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-primary-600" />
            <span className="text-sm text-secondary-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-secondary-100" />
            <span className="text-sm text-secondary-600">Not Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-warning-100 border border-warning-300" />
            <span className="text-sm text-secondary-600">Booked</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
