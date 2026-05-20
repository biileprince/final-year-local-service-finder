import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Toggle a favorite from the user's list. Idempotent: adding twice is a
   * no-op (returns the existing row), removing what isn't there throws 404.
   * We avoid `upsert` for `add` because we want to surface the "already saved"
   * case as a returnable row, not a duplicate insert error.
   */
  async add(userId: string, providerId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { id: providerId, deletedAt: null },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    try {
      return await this.prisma.favorite.create({
        data: { userId, providerId },
      });
    } catch (err) {
      // P2002 = unique constraint violation. The user already saved this
      // provider — return the existing row so the client gets the same shape.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return this.prisma.favorite.findUniqueOrThrow({
          where: { userId_providerId: { userId, providerId } },
        });
      }
      throw err;
    }
  }

  async remove(userId: string, providerId: string) {
    const result = await this.prisma.favorite.deleteMany({
      where: { userId, providerId },
    });
    if (result.count === 0) {
      throw new NotFoundException("Favorite not found");
    }
    return { removed: true };
  }

  /**
   * Returns the user's saved providers, newest first, with the full provider
   * shape the customer-facing card needs (user, rating, location, categories,
   * gallery thumb). Hides soft-deleted providers and ones marked inactive so
   * the favorites page doesn't render dead listings.
   */
  async list(userId: string) {
    const rows = await this.prisma.favorite.findMany({
      where: {
        userId,
        provider: { deletedAt: null, isActive: true },
      },
      orderBy: { createdAt: "desc" },
      include: {
        provider: {
          include: {
            user: {
              select: { id: true, name: true, profileImage: true },
            },
            categories: { include: { category: true } },
            gallery: {
              take: 1,
              include: { file: { select: { url: true, thumbnailUrl: true } } },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      favoritedAt: r.createdAt,
      provider: r.provider,
    }));
  }

  /**
   * Bulk check whether a list of provider ids is favorited by the user.
   * Used by /providers/[id] and the search page to seed heart-button state
   * without N round-trips.
   */
  async idsFavoritedBy(
    userId: string,
    providerIds: string[],
  ): Promise<string[]> {
    if (providerIds.length === 0) return [];
    const rows = await this.prisma.favorite.findMany({
      where: { userId, providerId: { in: providerIds } },
      select: { providerId: true },
    });
    return rows.map((r) => r.providerId);
  }
}
