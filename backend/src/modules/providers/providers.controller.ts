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
import { ProvidersService } from "./providers.service";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { SearchProvidersDto } from "./dto/search-providers.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Public } from "../../common/decorators/public.decorator";
import { Roles, UserRole } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("providers")
@ApiTags("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a provider profile" })
  @ApiResponse({ status: 201, description: "Provider created successfully" })
  @ApiResponse({ status: 409, description: "Provider profile already exists" })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createProviderDto: CreateProviderDto,
  ) {
    return this.providersService.create({
      ...createProviderDto,
      userId: user.id,
    });
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "Search providers" })
  @ApiQuery({ name: "categoryId", required: false })
  @ApiQuery({ name: "location", required: false })
  @ApiQuery({ name: "minRating", required: false, type: Number })
  @ApiQuery({ name: "maxHourlyRate", required: false, type: Number })
  @ApiQuery({ name: "verified", required: false, type: Boolean })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["rating", "hourlyRate", "reviewCount", "createdAt"],
  })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  async search(@Query() query: SearchProvidersDto) {
    return this.providersService.search(query);
  }

  @Get("featured")
  @Public()
  @ApiOperation({ summary: "Get featured providers" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getFeatured(@Query("limit") limit?: number) {
    return this.providersService.getFeaturedProviders(limit);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user provider profile" })
  @ApiResponse({ status: 200, description: "Returns provider profile" })
  @ApiResponse({ status: 404, description: "Provider profile not found" })
  async getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.providersService.findByUserId(user.id);
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Get provider by ID" })
  @ApiResponse({ status: 200, description: "Returns provider details" })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async findOne(@Param("id") id: string) {
    return this.providersService.findById(id);
  }

  @Put("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user provider profile" })
  @ApiResponse({ status: 200, description: "Provider updated successfully" })
  async updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateProviderDto: UpdateProviderDto,
  ) {
    const provider = await this.providersService.findByUserId(user.id);
    return this.providersService.update(provider.id, user.id, updateProviderDto);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update provider by ID" })
  @ApiResponse({ status: 200, description: "Provider updated successfully" })
  @ApiResponse({ status: 403, description: "Not authorized" })
  @ApiResponse({ status: 404, description: "Provider not found" })
  async update(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() updateProviderDto: UpdateProviderDto,
  ) {
    return this.providersService.update(id, user.id, updateProviderDto);
  }

  @Put(":id/categories")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update provider categories" })
  async updateCategories(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body("categoryIds") categoryIds: string[],
  ) {
    return this.providersService.updateCategories(id, user.id, categoryIds);
  }

  @Put(":id/specialties")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update provider specialties" })
  async updateSpecialties(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body("specialties") specialties: string[],
  ) {
    return this.providersService.updateSpecialties(id, user.id, specialties);
  }

  @Post(":id/gallery")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add files to provider gallery" })
  async addGallery(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body("fileIds") fileIds: string[],
  ) {
    return this.providersService.addGalleryItems(id, user.id, fileIds || []);
  }

  @Delete(":id/gallery/:itemId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Remove a gallery item" })
  async removeGalleryItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.providersService.removeGalleryItem(id, user.id, itemId);
  }

  @Put(":id/verification-documents")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Attach uploaded ID / business-license files to the provider",
  })
  async setVerificationDocuments(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: { idDocumentId?: string | null; businessLicenseId?: string | null },
  ) {
    return this.providersService.setVerificationDocuments(id, user.id, body);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete provider profile" })
  @ApiResponse({ status: 200, description: "Provider deleted successfully" })
  async delete(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.providersService.delete(id, user.id);
  }
}
