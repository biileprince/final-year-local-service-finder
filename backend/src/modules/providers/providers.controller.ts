import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { UpsertProviderHoursDto } from "./dto/upsert-provider-hours.dto";
import {
  CreateProviderServiceDto,
  UpdateProviderServiceDto,
} from "./dto/create-provider-service.dto";
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
    // First-time onboarding: no provider row exists yet, so create one.
    // Subsequent saves update the existing row.
    try {
      const provider = await this.providersService.findByUserId(user.id);
      return await this.providersService.update(
        provider.id,
        user.id,
        updateProviderDto,
      );
    } catch {
      return this.providersService.create({
        userId: user.id,
        hourlyRate: updateProviderDto.hourlyRate ?? 0,
        location: updateProviderDto.location ?? "",
        bio: updateProviderDto.bio,
        yearsExperience: updateProviderDto.yearsExperience,
        latitude: updateProviderDto.latitude,
        longitude: updateProviderDto.longitude,
        serviceRadiusKm: updateProviderDto.serviceRadiusKm,
      });
    }
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

  // --------------------------------------------------------------------------
  // Business hours
  // --------------------------------------------------------------------------

  @Get("me/hours")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current provider's business hours" })
  async getMyHours(@CurrentUser() user: CurrentUserPayload) {
    return this.providersService.getHoursByUserId(user.id);
  }

  @Get(":id/hours")
  @Public()
  @ApiOperation({ summary: "Get business hours for a provider (public)" })
  async getProviderHours(@Param("id") id: string) {
    return this.providersService.getHours(id);
  }

  @Put("me/hours")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Upsert business hours for the current provider" })
  async upsertMyHours(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpsertProviderHoursDto,
  ) {
    return this.providersService.upsertHours(user.id, dto.hours);
  }

  // --------------------------------------------------------------------------
  // Service-level pricing
  // --------------------------------------------------------------------------

  @Get("me/services")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current provider's services" })
  async getMyServices(@CurrentUser() user: CurrentUserPayload) {
    return this.providersService.getServicesByUserId(user.id);
  }

  @Get(":id/services")
  @Public()
  @ApiOperation({ summary: "List active services for a provider (public)" })
  async getProviderServices(@Param("id") id: string) {
    return this.providersService.getServices(id, true);
  }

  @Post("me/services")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new service offering" })
  async createService(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProviderServiceDto,
  ) {
    return this.providersService.createService(user.id, dto);
  }

  @Patch("me/services/:serviceId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a service offering" })
  async updateService(
    @CurrentUser() user: CurrentUserPayload,
    @Param("serviceId") serviceId: string,
    @Body() dto: UpdateProviderServiceDto,
  ) {
    return this.providersService.updateService(user.id, serviceId, dto);
  }

  @Delete("me/services/:serviceId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a service offering" })
  async deleteService(
    @CurrentUser() user: CurrentUserPayload,
    @Param("serviceId") serviceId: string,
  ) {
    return this.providersService.deleteService(user.id, serviceId);
  }
}
