"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/spinner";
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
  const [applyingPreset, setApplyingPreset] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAvailability();
  }, [currentWeekStart]);

  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
      // New providers who haven't finished onboarding have no provider row
      // yet — `/availability/me` returns 404. Route them to onboarding instead
      // of bubbling the error to the Next.js error overlay.
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      if (msg.includes("not found") || msg.includes("404")) {
        setNeedsOnboarding(true);
      } else {
        console.error("Failed to load availability:", error);
      }
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

  const applyPreset = async (
    preset: "weekdays-9-5" | "weekends" | "clear",
    weeksAhead = 4,
  ) => {
    setApplyingPreset(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const data: { date: string; timeSlots: { startTime: string; endTime: string }[] }[] = [];

      const weekdaySlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
      const weekendSlots = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

      for (let i = 0; i < weeksAhead * 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const day = d.getDay();
        const dateKey = d.toISOString().split("T")[0]!;
        let times: string[] = [];
        if (preset === "weekdays-9-5" && day >= 1 && day <= 5) {
          times = weekdaySlots;
        } else if (preset === "weekends" && (day === 0 || day === 6)) {
          times = weekendSlots;
        }
        // For clear preset, all days get []
        data.push({
          date: dateKey,
          timeSlots: times.map((t) => ({
            startTime: t,
            endTime: `${(parseInt(t.split(":")[0]!, 10) + 1).toString().padStart(2, "0")}:00`,
          })),
        });
      }

      await availabilityService.setAvailability(data);
      await loadAvailability();
      toast({
        variant: "success",
        title: "Schedule applied",
        description: `Applied to the next ${weeksAhead} weeks.`,
      });
    } catch (err) {
      toast({
        variant: "error",
        title: "Failed to apply preset",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setApplyingPreset(false);
    }
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
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  {Array.from({ length: 4 }).map((__, j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-md" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
            <CalendarIcon className="h-7 w-7 text-primary-600" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-secondary-900">
            Finish onboarding to set your hours
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-secondary-600">
            Availability lives on your provider profile — complete onboarding
            and we&apos;ll bring you back here to schedule.
          </p>
          <Button asChild className="mt-6">
            <Link href="/onboarding">Continue onboarding</Link>
          </Button>
        </CardContent>
      </Card>
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
        /* Recurring Schedule — quick presets that expand into the next 4 weeks */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Quick presets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-secondary-600">
              Apply a recurring schedule to the next 4 weeks. You can still
              tweak individual days from the Weekly View afterwards.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={() => applyPreset("weekdays-9-5")}
                disabled={applyingPreset}
                className="rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-primary-400 hover:bg-primary-50 disabled:opacity-50"
              >
                <p className="font-bold text-secondary-900">9–5 weekdays</p>
                <p className="mt-1 text-xs text-secondary-500">
                  Mon–Fri, 09:00–17:00 hourly slots.
                </p>
              </button>
              <button
                onClick={() => applyPreset("weekends")}
                disabled={applyingPreset}
                className="rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-primary-400 hover:bg-primary-50 disabled:opacity-50"
              >
                <p className="font-bold text-secondary-900">Weekends only</p>
                <p className="mt-1 text-xs text-secondary-500">
                  Sat–Sun, 10:00–16:00 hourly slots.
                </p>
              </button>
              <button
                onClick={() => applyPreset("clear")}
                disabled={applyingPreset}
                className="rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-error-300 hover:bg-error-50 disabled:opacity-50"
              >
                <p className="font-bold text-secondary-900">Clear schedule</p>
                <p className="mt-1 text-xs text-secondary-500">
                  Wipe availability for the next 4 weeks.
                </p>
              </button>
            </div>
            {applyingPreset && (
              <p className="text-sm text-secondary-500">Applying preset…</p>
            )}
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
