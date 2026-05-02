import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { NotificationType as PrismaNotificationType } from "@prisma/client";

export interface CreateNotificationData {
  userId: string;
  title: string;
  body: string;
  type: PrismaNotificationType;
  referenceType?: string;
  referenceId?: string;
}

export interface NotificationListParams {
  unreadOnly?: boolean;
  limit?: number;
  before?: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationData) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
      },
    });
  }

  async findByUser(userId: string, params: NotificationListParams = {}) {
    const { unreadOnly = false, limit = 20, before } = params;

    const where: any = {
      userId,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    if (before) {
      const beforeNotification = await this.prisma.notification.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });

      if (beforeNotification) {
        where.createdAt = { lt: beforeNotification.createdAt };
      }
    }

    return this.prisma.notification.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return this.prisma.notification.findUnique({
      where: { id },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  async deleteOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });
  }
}
