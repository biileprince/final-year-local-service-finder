import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  MessagesRepository,
  CreateMessageData,
  MessageListParams,
} from "./messages.repository";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async getOrCreateConversation(
    callerUserId: string,
    providerId: string,
    bookingId?: string,
  ) {
    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, userId: true },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    // Determine the conversation's customerId.
    // - If the caller is the provider's owner, derive it from the booking
    //   (so a provider clicking "Message" on a booking opens the chat with
    //   that booking's customer).
    // - Otherwise the caller IS the customer.
    let customerId = callerUserId;
    const callerIsProvider = provider.userId === callerUserId;

    if (callerIsProvider) {
      if (!bookingId) {
        throw new ForbiddenException(
          "Providers can only start conversations from a booking",
        );
      }
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { customerId: true, providerId: true },
      });
      if (!booking || booking.providerId !== providerId) {
        throw new NotFoundException("Booking not found for this provider");
      }
      customerId = booking.customerId;
    } else if (bookingId) {
      // Validate booking belongs to caller and provider
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { customerId: true, providerId: true },
      });
      if (
        !booking ||
        booking.providerId !== providerId ||
        booking.customerId !== callerUserId
      ) {
        throw new ForbiddenException("Booking does not match conversation");
      }
    }

    return this.messagesRepository.findOrCreateConversation({
      customerId,
      providerId,
      bookingId,
    });
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.messagesRepository.findConversationById(id);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    // Verify user is a participant
    const isCustomer = conversation.customerId === userId;
    const isProvider = conversation.provider.userId === userId;

    if (!isCustomer && !isProvider) {
      throw new ForbiddenException("Not authorized to view this conversation");
    }

    return conversation;
  }

  async getUserConversations(userId: string) {
    // Backfill: ensure every booking the user is part of has a conversation.
    // Older bookings created before the auto-create flow won't have one, and
    // a transient failure during booking creation could also leave a gap.
    // findOrCreateConversation is idempotent thanks to the unique
    // (customerId, providerId) constraint, so this is safe to run on every load.
    await this.backfillConversationsForUser(userId);

    // Get conversations where user is customer
    const customerConversations =
      await this.messagesRepository.getUserConversations(userId, "customer");

    // Get conversations where user is provider
    const providerConversations =
      await this.messagesRepository.getUserConversations(userId, "provider");

    // Merge and sort by lastMessageAt
    const allConversations = [
      ...customerConversations.map((c) => ({ ...c, role: "customer" as const })),
      ...providerConversations.map((c) => ({ ...c, role: "provider" as const })),
    ].sort((a, b) => {
      const dateA = a.lastMessageAt?.getTime() || 0;
      const dateB = b.lastMessageAt?.getTime() || 0;
      return dateB - dateA;
    });

    return allConversations;
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType?: string,
    fileId?: string,
  ) {
    // Verify conversation exists and user is participant
    const conversation = await this.getConversation(conversationId, senderId);

    // Create message
    const message = await this.messagesRepository.createMessage({
      conversationId,
      senderId,
      content,
      messageType,
      fileId,
    });

    // Update conversation
    await this.messagesRepository.updateConversationLastMessage(
      conversationId,
      content,
      senderId,
    );

    return message;
  }

  async getMessages(conversationId: string, userId: string, params: Partial<MessageListParams>) {
    // Verify access
    await this.getConversation(conversationId, userId);

    return this.messagesRepository.getMessages({
      conversationId,
      ...params,
    });
  }

  async markAsRead(conversationId: string, userId: string) {
    // Verify access
    await this.getConversation(conversationId, userId);

    // Mark messages as read
    await this.messagesRepository.markMessagesAsRead(conversationId, userId);

    // Update conversation read status
    await this.messagesRepository.markConversationAsRead(conversationId, userId);

    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const customerCount = await this.messagesRepository.getUnreadCount(
      userId,
      "customer",
    );
    const providerCount = await this.messagesRepository.getUnreadCount(
      userId,
      "provider",
    );

    return {
      total: customerCount + providerCount,
      asCustomer: customerCount,
      asProvider: providerCount,
    };
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: true,
      },
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException("Not authorized to delete this message");
    }

    await this.messagesRepository.deleteMessage(messageId);

    return { success: true };
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException("Not authorized to edit this message");
    }

    return this.messagesRepository.editMessage(messageId, content);
  }

  private async backfillConversationsForUser(userId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [{ customerId: userId }, { provider: { userId } }],
        deletedAt: null,
      },
      select: {
        id: true,
        customerId: true,
        providerId: true,
      },
    });

    if (bookings.length === 0) return;

    const seen = new Set<string>();
    for (const b of bookings) {
      const key = `${b.customerId}:${b.providerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        await this.messagesRepository.findOrCreateConversation({
          customerId: b.customerId,
          providerId: b.providerId,
          bookingId: b.id,
        });
      } catch {
        // ignore — race against unique constraint is fine, next call will find it
      }
    }
  }

  // For WebSocket notifications
  async getParticipantIds(conversationId: string): Promise<string[]> {
    const conversation = await this.messagesRepository.findConversationById(
      conversationId,
    );

    if (!conversation) return [];

    return [conversation.customerId, conversation.provider.userId];
  }
}
