import { apiClient, buildQueryString } from "./client";
import type { Conversation, Message } from "@/types";

export interface SendMessageDto {
  content: string;
  messageType?: string;
  fileId?: string;
}

export const messagesService = {
  async getConversations(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>("/messages/conversations", true);
  },

  async getConversation(id: string): Promise<Conversation> {
    return apiClient.get<Conversation>(`/messages/conversations/${id}`, true);
  },

  async getMessages(
    conversationId: string,
    params?: { before?: string; limit?: number }
  ): Promise<Message[]> {
    const queryString = buildQueryString(params || {});
    return apiClient.get<Message[]>(
      `/messages/conversations/${conversationId}/messages${queryString}`,
      true
    );
  },

  async startConversation(providerId: string, bookingId?: string): Promise<Conversation> {
    return apiClient.post<Conversation>(
      "/messages/conversations",
      { providerId, bookingId },
      true
    );
  },

  async sendMessage(conversationId: string, data: SendMessageDto): Promise<Message> {
    return apiClient.post<Message>(
      `/messages/conversations/${conversationId}/messages`,
      data,
      true
    );
  },

  async markAsRead(conversationId: string): Promise<void> {
    return apiClient.put(`/messages/conversations/${conversationId}/read`, {}, true);
  },

  async getUnreadCount(): Promise<{ total: number; asCustomer: number; asProvider: number }> {
    return apiClient.get("/messages/unread-count", true);
  },
};
