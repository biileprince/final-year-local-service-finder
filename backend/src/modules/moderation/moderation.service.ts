import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, ReportReason, ReportStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface CreateReportInput {
  reportedUserId: string;
  conversationId?: string;
  messageId?: string;
  reason: ReportReason;
  details?: string;
}

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException("You can't block yourself");
    }
    const target = await this.prisma.user.findFirst({
      where: { id: blockedId, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    try {
      return await this.prisma.userBlock.create({
        data: { blockerId, blockedId },
      });
    } catch (err) {
      // Already blocked — return the existing row so the client sees the same shape.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return this.prisma.userBlock.findUniqueOrThrow({
          where: { blockerId_blockedId: { blockerId, blockedId } },
        });
      }
      throw err;
    }
  }

  async unblockUser(blockerId: string, blockedId: string) {
    const result = await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });
    if (result.count === 0) {
      throw new NotFoundException("You haven't blocked this user");
    }
    return { unblocked: true };
  }

  async listBlocks(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        blocked: { select: { id: true, name: true, profileImage: true } },
      },
    });
    return rows.map((r) => ({ blockedAt: r.createdAt, user: r.blocked }));
  }

  /** { blockedByMe, blockedByThem } between the caller and another user. */
  async getBlockStatus(userId: string, otherUserId: string) {
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
      select: { blockerId: true },
    });
    return {
      blockedByMe: blocks.some((b) => b.blockerId === userId),
      blockedByThem: blocks.some((b) => b.blockerId === otherUserId),
    };
  }

  /** True if either user has blocked the other — used to gate messaging. */
  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const count = await this.prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return count > 0;
  }

  async createReport(reporterId: string, input: CreateReportInput) {
    if (reporterId === input.reportedUserId) {
      throw new BadRequestException("You can't report yourself");
    }
    const target = await this.prisma.user.findFirst({
      where: { id: input.reportedUserId, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }

    // If the report is tied to a conversation, the reporter must be a participant.
    if (input.conversationId) {
      const convo = await this.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { customerId: true, provider: { select: { userId: true } } },
      });
      if (!convo) {
        throw new NotFoundException("Conversation not found");
      }
      const isParticipant =
        convo.customerId === reporterId ||
        convo.provider.userId === reporterId;
      if (!isParticipant) {
        throw new ForbiddenException("Not a participant in this conversation");
      }
    }

    return this.prisma.userReport.create({
      data: {
        reporterId,
        reportedId: input.reportedUserId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        reason: input.reason,
        details: input.details,
      },
    });
  }

  // --- Admin ---

  async listReports(status?: ReportStatus) {
    return this.prisma.userReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reported: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
  }

  async resolveReport(
    reportId: string,
    adminId: string,
    status: ReportStatus,
    resolutionNote?: string,
  ) {
    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });
    if (!report) {
      throw new NotFoundException("Report not found");
    }
    return this.prisma.userReport.update({
      where: { id: reportId },
      data: {
        status,
        resolutionNote,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
  }
}
