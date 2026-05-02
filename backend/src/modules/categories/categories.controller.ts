import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Public } from "../../common/decorators/public.decorator";
import { Roles, UserRole } from "../../common/decorators/roles.decorator";

@Controller("categories")
@ApiTags("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "Get all categories" })
  @ApiQuery({ name: "includeInactive", required: false, type: Boolean })
  async findAll(@Query("includeInactive") includeInactive?: boolean) {
    return this.categoriesService.findAll(includeInactive === true);
  }

  @Get("top")
  @Public()
  @ApiOperation({ summary: "Get top categories by provider count" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getTopCategories(@Query("limit") limit?: number) {
    return this.categoriesService.getTopCategories(limit);
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Get category by ID" })
  @ApiResponse({ status: 200, description: "Returns category details" })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findOne(@Param("id") id: string) {
    return this.categoriesService.findById(id);
  }

  @Get("slug/:slug")
  @Public()
  @ApiOperation({ summary: "Get category by slug" })
  async findBySlug(@Param("slug") slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a category (Admin only)" })
  @ApiResponse({ status: 201, description: "Category created successfully" })
  @ApiResponse({ status: 409, description: "Category slug already exists" })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a category (Admin only)" })
  @ApiResponse({ status: 200, description: "Category updated successfully" })
  async update(
    @Param("id") id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Put("reorder")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reorder categories (Admin only)" })
  async reorderCategories(
    @Body() orders: { id: string; displayOrder: number }[],
  ) {
    return this.categoriesService.reorderCategories(orders);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a category (Admin only)" })
  @ApiResponse({ status: 200, description: "Category deleted successfully" })
  @ApiResponse({
    status: 409,
    description: "Cannot delete category with providers/subcategories",
  })
  async delete(@Param("id") id: string) {
    return this.categoriesService.delete(id);
  }
}
