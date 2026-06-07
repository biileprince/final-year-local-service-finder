import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  UsersRepository,
  CreateUserData,
  UpdateUserData,
} from "./users.repository";
import * as bcrypt from "bcrypt";
import { PasswordSecurityService } from "../../common/security/password-security.service";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordSecurityService: PasswordSecurityService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreateUserData) {
    return this.usersRepository.create(data);
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async update(id: string, data: UpdateUserData) {
    await this.findById(id); // Ensure user exists
    return this.usersRepository.update(id, data);
  }

  async updateLastLogin(id: string) {
    return this.usersRepository.updateLastLogin(id);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository.findByIdWithPassword(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new ConflictException("Current password is incorrect");
    }

    // Reject passwords that appear in known breach corpora.
    await this.passwordSecurityService.assertNotBreached(newPassword);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePassword(id, hashedPassword);

    return { message: "Password updated successfully" };
  }

  async delete(id: string) {
    await this.findById(id); // Ensure user exists
    await this.usersRepository.softDelete(id);
    // Kill every active session so the deleted account can't keep using a
    // still-valid refresh token after erasure.
    await this.cacheService.deleteAllRefreshTokens(id);
    return { message: "User deleted successfully" };
  }

  /**
   * GDPR Art. 15 / 20 — assembles a full machine-readable copy of every piece
   * of personal data tied to the account. Excludes the password hash and any
   * other user's PII (counterparties in bookings/conversations are referenced
   * by name only, which they consented to share for the transaction).
   */
  async exportData(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        profileImage: true,
        role: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [
      provider,
      bookings,
      reviews,
      messages,
      conversations,
      notifications,
      favorites,
      files,
      sessions,
      auditLogs,
    ] = await Promise.all([
      this.prisma.provider.findUnique({
        where: { userId: id },
        include: {
          categories: { include: { category: { select: { name: true } } } },
          specialties: true,
          gallery: true,
          hours: true,
          services: true,
        },
      }),
      this.prisma.booking.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.review.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.message.findMany({
        where: { senderId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.conversation.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.favorite.findMany({
        where: { userId: id },
        include: {
          provider: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      }),
      this.prisma.file.findMany({
        where: { uploadedById: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.refreshToken.findMany({
        where: { userId: id },
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          ipAddress: true,
          userAgent: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: user,
      providerProfile: provider,
      bookings,
      reviews,
      messagesSent: messages,
      conversations,
      notifications,
      favorites,
      uploadedFiles: files,
      sessions,
      auditLogs,
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, role, search } = params;
    const skip = (page - 1) * limit;

    return this.usersRepository.findAll({
      skip,
      take: limit,
      role,
      search,
    });
  }
}
