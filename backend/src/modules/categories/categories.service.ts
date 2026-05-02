import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";

export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  displayOrder?: number;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  displayOrder?: number;
  isActive?: boolean;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(data: CreateCategoryData) {
    // Check for duplicate slug
    const existing = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new ConflictException("Category with this slug already exists");
    }

    const category = await this.prisma.category.create({
      data,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.cacheService.invalidateCategories();

    return category;
  }

  async findAll(includeInactive: boolean = false) {
    // Try cache first
    if (!includeInactive) {
      const cached = await this.cacheService.getCategories();
      if (cached) {
        return cached;
      }
    }

    const where = includeInactive ? {} : { isActive: true, deletedAt: null };

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: includeInactive ? {} : { isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            providerCount: true,
          },
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: {
            providers: true,
          },
        },
      },
    });

    // Cache if not including inactive
    if (!includeInactive) {
      await this.cacheService.setCategories(categories);
    }

    return categories;
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            providerCount: true,
          },
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: {
            providers: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            providerCount: true,
          },
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: {
            providers: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return category;
  }

  async update(id: string, data: UpdateCategoryData) {
    await this.findById(id); // Ensure exists

    // Check for duplicate slug if updating
    if (data.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug: data.slug,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException("Category with this slug already exists");
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.cacheService.invalidateCategories();

    return category;
  }

  async delete(id: string) {
    await this.findById(id); // Ensure exists

    // Check if category has providers
    const providerCount = await this.prisma.providerCategory.count({
      where: { categoryId: id },
    });

    if (providerCount > 0) {
      throw new ConflictException(
        "Cannot delete category with associated providers",
      );
    }

    // Check if category has children
    const childCount = await this.prisma.category.count({
      where: { parentId: id },
    });

    if (childCount > 0) {
      throw new ConflictException("Cannot delete category with subcategories");
    }

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Invalidate cache
    await this.cacheService.invalidateCategories();

    return { message: "Category deleted successfully" };
  }

  async getTopCategories(limit: number = 10) {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        parentId: null, // Only top-level categories
      },
      orderBy: { providerCount: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        providerCount: true,
      },
    });
  }

  async updateProviderCount(categoryId: string) {
    const count = await this.prisma.providerCategory.count({
      where: {
        categoryId,
        provider: {
          isActive: true,
          deletedAt: null,
        },
      },
    });

    await this.prisma.category.update({
      where: { id: categoryId },
      data: { providerCount: count },
    });

    // Invalidate cache
    await this.cacheService.invalidateCategories();
  }

  async reorderCategories(
    categoryOrders: { id: string; displayOrder: number }[],
  ) {
    await this.prisma.$transaction(
      categoryOrders.map(({ id, displayOrder }) =>
        this.prisma.category.update({
          where: { id },
          data: { displayOrder },
        }),
      ),
    );

    // Invalidate cache
    await this.cacheService.invalidateCategories();

    return { message: "Categories reordered successfully" };
  }
}
