import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "@prisma/client";

export interface CreateConversationData {
  customerId: string;
  providerId: string;
  bookingId?: string;
}

export interface CreateMessageData {
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: string;
  fileId?: string;
}

export interface MessageListParams {
  conversationId: string;
  before?: string;
  limit?: number;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // Conversation Operations
  // ============================================================================

  async createConversation(data: CreateConversationData) {
    return this.prisma.conversation.create({
      data: {
        customerId: data.customerId,
        providerId: data.providerId,
        bookingId: data.bookingId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  async findConversationById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
          },
        },
      },
    });
  }

  async findConversationByParticipants(customerId: string, providerId: string) {
    return this.prisma.conversation.findUnique({
      where: {
        customerId_providerId: {
          customerId,
          providerId,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  async findOrCreateConversation(data: CreateConversationData) {
    const existing = await this.findConversationByParticipants(
      data.customerId,
      data.providerId,
    );

    if (existing) {
      return existing;
    }

    return this.createConversation(data);
  }

  async getUserConversations(userId: string, role: "customer" | "provider") {
    const where: Prisma.ConversationWhereInput =
      role === "customer" ? { customerId: userId } : { provider: { userId } };

    return this.prisma.conversation.findMany({
      where: {
        ...where,
        isActive: true,
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
          },
        },
      },
    });
  }

  async updateConversationLastMessage(
    id: string,
    preview: string,
    senderId: string,
  ) {
    const conversation = await this.findConversationById(id);
    if (!conversation) return null;

    const isCustomerSender = conversation.customerId === senderId;

    return this.prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview.substring(0, 100),
        // Increment unread count for the other party
        customerUnreadCount: isCustomerSender ? undefined : { increment: 1 },
        providerUnreadCount: isCustomerSender ? { increment: 1 } : undefined,
      },
    });
  }

  async markConversationAsRead(id: string, userId: string) {
    const conversation = await this.findConversationById(id);
    if (!conversation) return null;

    const isCustomer = conversation.customerId === userId;

    return this.prisma.conversation.update({
      where: { id },
      data: isCustomer
        ? {
            customerLastReadAt: new Date(),
            customerUnreadCount: 0,
          }
        : {
            providerLastReadAt: new Date(),
            providerUnreadCount: 0,
          },
    });
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async createMessage(data: CreateMessageData) {
    return this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        messageType: data.messageType || "text",
        fileId: data.fileId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        file: data.fileId
          ? {
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
                fileName: true,
                fileType: true,
              },
            }
          : false,
      },
    });
  }

  async getMessages(params: MessageListParams) {
    const { conversationId, before, limit = 50 } = params;

    const where: Prisma.MessageWhereInput = {
      conversationId,
      deletedAt: null,
    };

    if (before) {
      const beforeMessage = await this.prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });

      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        file: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            fileName: true,
            fileType: true,
          },
        },
      },
    });

    // Return in chronological order
    return messages.reverse();
  }

  async markMessagesAsRead(conversationId: string, userId: string) {
    return this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string, role: "customer" | "provider") {
    if (role === "customer") {
      const result = await this.prisma.conversation.aggregate({
        where: { customerId: userId, isActive: true },
        _sum: { customerUnreadCount: true },
      });
      return result._sum.customerUnreadCount || 0;
    } else {
      const result = await this.prisma.conversation.aggregate({
        where: { provider: { userId }, isActive: true },
        _sum: { providerUnreadCount: true },
      });
      return result._sum.providerUnreadCount || 0;
    }
  }

  async deleteMessage(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async editMessage(id: string, content: string) {
    return this.prisma.message.update({
      where: { id },
      data: {
        content,
        editedAt: new Date(),
      },
    });
  }
}
