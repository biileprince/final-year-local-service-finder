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
    customerId: string,
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

  // For WebSocket notifications
  async getParticipantIds(conversationId: string): Promise<string[]> {
    const conversation = await this.messagesRepository.findConversationById(
      conversationId,
    );

    if (!conversation) return [];

    return [conversation.customerId, conversation.provider.userId];
  }
}
