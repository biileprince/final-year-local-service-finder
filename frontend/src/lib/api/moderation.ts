import { apiClient } from "./client";

export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "INAPPROPRIATE"
  | "SCAM"
  | "OTHER";

export interface BlockStatus {
  blockedByMe: boolean;
  blockedByThem: boolean;
}

export interface CreateReportInput {
  reportedUserId: string;
  conversationId?: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
}

export const moderationService = {
  async blockStatus(userId: string): Promise<BlockStatus> {
    return apiClient.get<BlockStatus>(`/moderation/block-status/${userId}`, true);
  },

  async block(userId: string): Promise<void> {
    await apiClient.post(`/moderation/block/${userId}`, undefined, true);
  },

  async unblock(userId: string): Promise<void> {
    await apiClient.delete(`/moderation/block/${userId}`, true);
  },

  async report(input: CreateReportInput): Promise<void> {
    await apiClient.post("/moderation/report", input, true);
  },
};
