import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { NotificationType as PrismaNotificationType } from "@prisma/client";
import { NotificationsRepository } from "./notifications.repository";
import { EmailService } from "./services/email.service";
import { SmsService } from "./services/sms.service";

// Internal notification categories (stored in referenceType)
export enum NotificationCategory {
  BOOKING_CONFIRMED = "booking_confirmed",
  BOOKING_CANCELLED = "booking_cancelled",
  BOOKING_REMINDER = "booking_reminder",
  BOOKING_COMPLETED = "booking_completed",
  NEW_REVIEW = "new_review",
  REVIEW_RESPONSE = "review_response",
  NEW_MESSAGE = "new_message",
  PROVIDER_VERIFIED = "provider_verified",
  PROVIDER_SUSPENDED = "provider_suspended",
  SYSTEM = "system",
}

export enum NotificationPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

export interface SendNotificationOptions {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  referenceId?: string;
  channels?: ("in_app" | "email" | "sms" | "push")[];
  priority?: NotificationPriority;
  /**
   * When set, overrides the default email payload so each transactional template
   * (welcome, booking-confirmed, etc.) gets the rich data it needs to render.
   * Without this, the email falls back to the generic title/body block.
   */
  email?: {
    template: string;
    data: Record<string, any>;
    /** Optional override; templates supply their own subject by default. */
    subject?: string;
  };
}

export interface BookingNotificationData {
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  providerName: string;
  serviceName?: string;
  date: string;
  time: string;
  amount?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly repository: NotificationsRepository,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  // ============================================================================
  // Core Notification Methods
  // ============================================================================

  async send(options: SendNotificationOptions) {
    const {
      userId,
      category,
      title,
      body,
      referenceId,
      channels = ["in_app"],
      priority = NotificationPriority.NORMAL,
    } = options;

    // Get user and preferences
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found for notification`);
      return null;
    }

    const preferences = user.notificationPreferences;
    const results: Record<string, boolean> = {};

    // Create in-app notification
    if (channels.includes("in_app")) {
      try {
        await this.repository.create({
          userId,
          title,
          body,
          type: PrismaNotificationType.IN_APP,
          referenceType: category,
          referenceId,
        });
        results.inApp = true;
      } catch (error) {
        this.logger.error(`Failed to create in-app notification: ${(error as Error).message}`);
        results.inApp = false;
      }
    }

    // Send email if enabled
    if (
      channels.includes("email") &&
      user.email &&
      this.isChannelEnabled(preferences, category, "email")
    ) {
      try {
        const emailOverride = options.email;
        await this.emailService.send({
          to: user.email,
          subject: emailOverride?.subject ?? title,
          template: emailOverride?.template ?? this.getEmailTemplate(category),
          data: emailOverride?.data ?? { title, body, name: user.name, referenceId },
        });

        // Record email notification
        await this.repository.create({
          userId,
          title,
          body,
          type: PrismaNotificationType.EMAIL,
          referenceType: category,
          referenceId,
        });

        results.email = true;
      } catch (error) {
        this.logger.error(`Failed to send email: ${(error as Error).message}`);
        results.email = false;
      }
    }

    // Send SMS if enabled and high priority
    if (
      channels.includes("sms") &&
      user.phone &&
      this.isChannelEnabled(preferences, category, "sms") &&
      priority >= NotificationPriority.HIGH
    ) {
      try {
        await this.smsService.send({
          to: user.phone,
          message: `${title}: ${body}`,
        });

        // Record SMS notification
        await this.repository.create({
          userId,
          title,
          body,
          type: PrismaNotificationType.SMS,
          referenceType: category,
          referenceId,
        });

        results.sms = true;
      } catch (error) {
        this.logger.error(`Failed to send SMS: ${(error as Error).message}`);
        results.sms = false;
      }
    }

    return results;
  }

  // ============================================================================
  // Booking Notifications
  // ============================================================================

  async sendBookingConfirmation(
    customerId: string,
    providerId: string,
    data: BookingNotificationData,
  ) {
    // Notify customer
    await this.send({
      userId: customerId,
      category: NotificationCategory.BOOKING_CONFIRMED,
      title: "Booking Confirmed",
      body: `Your booking #${data.bookingNumber} with ${data.providerName} has been confirmed for ${data.date} at ${data.time}.`,
      referenceId: data.bookingId,
      channels: ["in_app", "email", "sms"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "booking-confirmed",
        data: {
          recipientName: data.customerName,
          counterpartName: data.providerName,
          bookingNumber: data.bookingNumber,
          date: data.date,
          time: data.time,
          isProvider: false,
        },
      },
    });

    // Notify provider
    await this.send({
      userId: providerId,
      category: NotificationCategory.BOOKING_CONFIRMED,
      title: "New Booking Received",
      body: `You have a new booking #${data.bookingNumber} from ${data.customerName} for ${data.date} at ${data.time}.`,
      referenceId: data.bookingId,
      channels: ["in_app", "email", "sms"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "booking-confirmed",
        data: {
          recipientName: data.providerName,
          counterpartName: data.customerName,
          bookingNumber: data.bookingNumber,
          date: data.date,
          time: data.time,
          isProvider: true,
        },
      },
    });
  }

  async sendBookingCancellation(
    customerId: string,
    providerId: string,
    data: BookingNotificationData,
    cancelledBy: "customer" | "provider" | "admin",
  ) {
    const cancelledByLabel =
      cancelledBy === "customer"
        ? "the customer"
        : cancelledBy === "provider"
          ? "the provider"
          : "an admin";

    // Notify customer
    await this.send({
      userId: customerId,
      category: NotificationCategory.BOOKING_CANCELLED,
      title: "Booking Cancelled",
      body:
        cancelledBy === "customer"
          ? `Your booking #${data.bookingNumber} has been cancelled.`
          : `Your booking #${data.bookingNumber} with ${data.providerName} has been cancelled by ${cancelledByLabel}.`,
      referenceId: data.bookingId,
      channels: ["in_app", "email"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "booking-cancelled",
        data: {
          recipientName: data.customerName,
          counterpartName: data.providerName,
          bookingNumber: data.bookingNumber,
          cancelledByLabel,
        },
      },
    });

    // Notify provider
    await this.send({
      userId: providerId,
      category: NotificationCategory.BOOKING_CANCELLED,
      title: "Booking Cancelled",
      body:
        cancelledBy === "provider"
          ? `You have cancelled booking #${data.bookingNumber}.`
          : `Booking #${data.bookingNumber} from ${data.customerName} has been cancelled by ${cancelledByLabel}.`,
      referenceId: data.bookingId,
      channels: ["in_app", "email"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "booking-cancelled",
        data: {
          recipientName: data.providerName,
          counterpartName: data.customerName,
          bookingNumber: data.bookingNumber,
          cancelledByLabel,
        },
      },
    });
  }

  async sendBookingReminder(
    userId: string,
    data: BookingNotificationData,
    hoursUntil: number,
    isProvider = false,
  ) {
    await this.send({
      userId,
      category: NotificationCategory.BOOKING_REMINDER,
      title: "Booking Reminder",
      body: `Reminder: You have a booking #${data.bookingNumber} in ${hoursUntil} hours on ${data.date} at ${data.time}.`,
      referenceId: data.bookingId,
      channels: ["in_app", "email", "sms"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "booking-reminder",
        data: {
          recipientName: isProvider ? data.providerName : data.customerName,
          counterpartName: isProvider ? data.customerName : data.providerName,
          bookingNumber: data.bookingNumber,
          date: data.date,
          time: data.time,
          hoursUntil,
        },
      },
    });
  }

  async sendBookingCompleted(
    customerId: string,
    providerId: string,
    data: BookingNotificationData,
  ) {
    // Notify customer - ask for review
    await this.send({
      userId: customerId,
      category: NotificationCategory.BOOKING_COMPLETED,
      title: "Service Completed",
      body: `Your service with ${data.providerName} has been completed. Please leave a review!`,
      referenceId: data.bookingId,
      channels: ["in_app", "email"],
      priority: NotificationPriority.NORMAL,
      email: {
        template: "booking-completed",
        data: {
          recipientName: data.customerName,
          providerName: data.providerName,
          bookingNumber: data.bookingNumber,
          bookingId: data.bookingId,
        },
      },
    });

    // Notify provider
    await this.send({
      userId: providerId,
      category: NotificationCategory.BOOKING_COMPLETED,
      title: "Service Completed",
      body: `You have completed the service for booking #${data.bookingNumber}.`,
      referenceId: data.bookingId,
      channels: ["in_app"],
      priority: NotificationPriority.NORMAL,
    });
  }

  // ============================================================================
  // Review Notifications
  // ============================================================================

  async sendNewReview(
    providerId: string,
    reviewerName: string,
    rating: number,
    bookingNumber: string,
    reviewId?: string,
    providerName?: string,
  ) {
    await this.send({
      userId: providerId,
      category: NotificationCategory.NEW_REVIEW,
      title: "New Review Received",
      body: `${reviewerName} left you a ${rating}-star review for booking #${bookingNumber}.`,
      referenceId: reviewId,
      channels: ["in_app", "email"],
      priority: NotificationPriority.NORMAL,
      email: {
        template: "new-review",
        data: {
          providerName: providerName ?? "there",
          customerName: reviewerName,
          rating,
          bookingNumber,
        },
      },
    });
  }

  async sendReviewResponse(
    customerId: string,
    providerName: string,
    bookingNumber: string,
    reviewId?: string,
  ) {
    await this.send({
      userId: customerId,
      category: NotificationCategory.REVIEW_RESPONSE,
      title: "Provider Responded to Your Review",
      body: `${providerName} responded to your review for booking #${bookingNumber}.`,
      referenceId: reviewId,
      channels: ["in_app"],
      priority: NotificationPriority.LOW,
    });
  }

  // ============================================================================
  // Message Notifications
  // ============================================================================

  async sendNewMessage(
    userId: string,
    senderName: string,
    messagePreview: string,
    conversationId: string,
  ) {
    await this.send({
      userId,
      category: NotificationCategory.NEW_MESSAGE,
      title: `New Message from ${senderName}`,
      body: messagePreview.substring(0, 100),
      referenceId: conversationId,
      channels: ["in_app"],
      priority: NotificationPriority.NORMAL,
    });
  }

  // ============================================================================
  // Provider Notifications
  // ============================================================================

  async sendProviderVerified(providerId: string, providerName: string) {
    await this.send({
      userId: providerId,
      category: NotificationCategory.PROVIDER_VERIFIED,
      title: "Account Verified",
      body: `Congratulations! Your provider account has been verified. You can now receive bookings.`,
      channels: ["in_app", "email"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "provider-verified",
        data: { providerName },
      },
    });
  }

  async sendProviderRejected(
    providerId: string,
    providerName: string,
    reason: string,
  ) {
    await this.send({
      userId: providerId,
      category: NotificationCategory.PROVIDER_SUSPENDED,
      title: "Verification needs another look",
      body: `Your provider verification was not accepted. ${reason ? `Reason: ${reason}. ` : ""}Update your documents and re-submit.`,
      channels: ["in_app", "email"],
      priority: NotificationPriority.HIGH,
      email: {
        template: "provider-rejected",
        data: { providerName, reason },
      },
    });
  }

  async sendProviderSuspended(providerId: string, reason: string) {
    await this.send({
      userId: providerId,
      category: NotificationCategory.PROVIDER_SUSPENDED,
      title: "Account Suspended",
      body: `Your provider account has been suspended. Reason: ${reason}. Please contact support.`,
      channels: ["in_app", "email", "sms"],
      priority: NotificationPriority.URGENT,
    });
  }

  async sendWelcomeEmail(
    userId: string,
    name: string,
    role: "CUSTOMER" | "PROVIDER",
    email: string,
  ) {
    try {
      await this.emailService.send({
        to: email,
        template: "welcome",
        data: { name, role },
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (err) {
      this.logger.error(
        `Failed to send welcome email to ${email}: ${(err as Error).message}`,
      );
    }
  }

  // ============================================================================
  // User CRUD Operations
  // ============================================================================

  async getUserNotifications(
    userId: string,
    params: { unreadOnly?: boolean; limit?: number; before?: string },
  ) {
    return this.repository.findByUser(userId, params);
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.repository.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string) {
    return this.repository.markAllAsRead(userId);
  }

  async getUnreadCount(userId: string) {
    return this.repository.getUnreadCount(userId);
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.repository.delete(notificationId, userId);
  }

  // ============================================================================
  // Preferences Management
  // ============================================================================

  async updatePreferences(userId: string, preferences: Partial<{
    emailBookingUpdates: boolean;
    emailMessages: boolean;
    emailReviews: boolean;
    emailPromotions: boolean;
    smsBookingUpdates: boolean;
    smsMessages: boolean;
    smsReminders: boolean;
    pushEnabled: boolean;
    pushBookingUpdates: boolean;
    pushMessages: boolean;
  }>) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences,
      },
    });
  }

  async getPreferences(userId: string) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Return defaults
      return {
        emailBookingUpdates: true,
        emailMessages: true,
        emailReviews: true,
        emailPromotions: false,
        smsBookingUpdates: true,
        smsMessages: false,
        smsReminders: true,
        pushEnabled: true,
        pushBookingUpdates: true,
        pushMessages: true,
      };
    }

    return prefs;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private isChannelEnabled(
    preferences: any,
    category: NotificationCategory,
    channel: "email" | "sms" | "push",
  ): boolean {
    // Default to enabled if no preferences set
    if (!preferences) return true;

    // Map category to preference field
    const prefMap: Record<string, Record<string, string>> = {
      [NotificationCategory.BOOKING_CONFIRMED]: {
        email: "emailBookingUpdates",
        sms: "smsBookingUpdates",
        push: "pushBookingUpdates",
      },
      [NotificationCategory.BOOKING_CANCELLED]: {
        email: "emailBookingUpdates",
        sms: "smsBookingUpdates",
        push: "pushBookingUpdates",
      },
      [NotificationCategory.BOOKING_REMINDER]: {
        email: "emailBookingUpdates",
        sms: "smsReminders",
        push: "pushBookingUpdates",
      },
      [NotificationCategory.BOOKING_COMPLETED]: {
        email: "emailBookingUpdates",
        sms: "smsBookingUpdates",
        push: "pushBookingUpdates",
      },
      [NotificationCategory.NEW_REVIEW]: {
        email: "emailReviews",
        sms: "smsBookingUpdates",
        push: "pushBookingUpdates",
      },
      [NotificationCategory.NEW_MESSAGE]: {
        email: "emailMessages",
        sms: "smsMessages",
        push: "pushMessages",
      },
    };

    const categoryPrefs = prefMap[category];
    if (!categoryPrefs) return true;

    const prefField = categoryPrefs[channel];
    if (!prefField) return true;

    return preferences[prefField] !== false;
  }

  private getEmailTemplate(category: NotificationCategory): string {
    const templates: Record<NotificationCategory, string> = {
      [NotificationCategory.BOOKING_CONFIRMED]: "booking-confirmed",
      [NotificationCategory.BOOKING_CANCELLED]: "booking-cancelled",
      [NotificationCategory.BOOKING_REMINDER]: "booking-reminder",
      [NotificationCategory.BOOKING_COMPLETED]: "booking-completed",
      [NotificationCategory.NEW_REVIEW]: "new-review",
      [NotificationCategory.REVIEW_RESPONSE]: "review-response",
      [NotificationCategory.NEW_MESSAGE]: "new-message",
      [NotificationCategory.PROVIDER_VERIFIED]: "provider-verified",
      [NotificationCategory.PROVIDER_SUSPENDED]: "provider-suspended",
      [NotificationCategory.SYSTEM]: "system",
    };
    return templates[category] || "default";
  }
}
