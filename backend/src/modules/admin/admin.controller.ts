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
import { UserRole } from "@prisma/client";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { SuspendUserDto } from "./dto/suspend-user.dto";
import { VerifyProviderDto } from "./dto/verify-provider.dto";
import { ModerateReviewDto } from "./dto/moderate-review.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CancelBookingDto } from "./dto/cancel-booking.dto";

@Controller("admin")
@ApiTags("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================================================
  // Dashboard & Analytics
  // ============================================================================

  @Get("dashboard")
  @ApiOperation({ summary: "Get dashboard statistics" })
  @ApiResponse({ status: 200, description: "Returns dashboard stats" })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get("analytics/revenue")
  @ApiOperation({ summary: "Get revenue analytics" })
  @ApiQuery({ name: "days", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Returns revenue data by date" })
  async getRevenueAnalytics(@Query("days") days?: string) {
    return this.adminService.getRevenueAnalytics(
      days ? parseInt(days, 10) : 30,
    );
  }

  // ============================================================================
  // User Management
  // ============================================================================

  @Get("users")
  @ApiOperation({ summary: "Get all users with pagination" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "role", required: false, enum: UserRole })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Returns paginated user list" })
  async getUsers(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("role") role?: UserRole,
    @Query("search") search?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      role,
      search,
    });
  }

  @Get("users/:id")
  @ApiOperation({ summary: "Get user details" })
  @ApiResponse({ status: 200, description: "Returns user details" })
  async getUserById(@Param("id") id: string) {
    return this.adminService.getUserById(id);
  }

  @Put("users/:id/role")
  @ApiOperation({ summary: "Update user role" })
  @ApiResponse({ status: 200, description: "User role updated" })
  async updateUserRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.updateUserRole(id, dto.role, admin.id);
  }

  @Post("users/:id/suspend")
  @ApiOperation({ summary: "Suspend a user" })
  @ApiResponse({ status: 200, description: "User suspended" })
  async suspendUser(
    @Param("id") id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.suspendUser(id, dto.reason, admin.id);
  }

  @Post("users/:id/reactivate")
  @ApiOperation({ summary: "Reactivate a suspended user" })
  @ApiResponse({ status: 200, description: "User reactivated" })
  async reactivateUser(
    @Param("id") id: string,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.reactivateUser(id, admin.id);
  }

  // ============================================================================
  // Provider Verification
  // ============================================================================

  @Get("providers/pending")
  @ApiOperation({ summary: "Get pending provider verifications" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Returns pending verifications" })
  async getPendingVerifications(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    return this.adminService.getPendingVerifications({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  @Post("providers/:id/verify")
  @ApiOperation({ summary: "Verify a provider" })
  @ApiResponse({ status: 200, description: "Provider verified" })
  async verifyProvider(
    @Param("id") id: string,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.verifyProvider(id, admin.id);
  }

  @Post("providers/:id/reject")
  @ApiOperation({ summary: "Reject a provider verification" })
  @ApiResponse({ status: 200, description: "Provider rejected" })
  async rejectProvider(
    @Param("id") id: string,
    @Body() dto: VerifyProviderDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.rejectProvider(id, dto.reason || "", admin.id);
  }

  // ============================================================================
  // Booking Management
  // ============================================================================

  @Get("bookings")
  @ApiOperation({ summary: "Get all bookings with filters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "providerId", required: false })
  @ApiQuery({ name: "customerId", required: false })
  @ApiResponse({ status: 200, description: "Returns paginated bookings" })
  async getBookings(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("providerId") providerId?: string,
    @Query("customerId") customerId?: string,
  ) {
    return this.adminService.getBookings({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status as any,
      providerId,
      customerId,
    });
  }

  @Get("bookings/:id")
  @ApiOperation({ summary: "Get booking details" })
  @ApiResponse({ status: 200, description: "Returns booking details" })
  async getBookingById(@Param("id") id: string) {
    return this.adminService.getBookingById(id);
  }

  @Post("bookings/:id/cancel")
  @ApiOperation({ summary: "Cancel a booking (admin)" })
  @ApiResponse({ status: 200, description: "Booking cancelled" })
  async cancelBooking(
    @Param("id") id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.cancelBooking(id, dto.reason, admin.id);
  }

  // ============================================================================
  // Review Moderation
  // ============================================================================

  @Get("reviews/reported")
  @ApiOperation({ summary: "Get reported reviews" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Returns reported reviews" })
  async getReportedReviews(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.getReportedReviews(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post("reviews/:id/moderate")
  @ApiOperation({ summary: "Moderate a review" })
  @ApiResponse({ status: 200, description: "Review moderated" })
  async moderateReview(
    @Param("id") id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.adminService.moderateReview(id, dto.action, admin.id);
  }

  // ============================================================================
  // Category Management
  // ============================================================================

  @Post("categories")
  @ApiOperation({ summary: "Create a new category" })
  @ApiResponse({ status: 201, description: "Category created" })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Put("categories/:id")
  @ApiOperation({ summary: "Update a category" })
  @ApiResponse({ status: 200, description: "Category updated" })
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @ApiOperation({ summary: "Delete a category" })
  @ApiResponse({ status: 200, description: "Category deleted" })
  async deleteCategory(@Param("id") id: string) {
    return this.adminService.deleteCategory(id);
    return { success: true };
  }

  // ============================================================================
  // System Health
  // ============================================================================

  @Get("system/health")
  @ApiOperation({ summary: "Get system health status" })
  @ApiResponse({ status: 200, description: "Returns system health" })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get("system/audit-logs")
  @ApiOperation({ summary: "Get audit logs" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Returns audit logs" })
  async getAuditLogs(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.getAuditLogs(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
