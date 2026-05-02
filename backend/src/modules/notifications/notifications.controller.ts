import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
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
import { NotificationsService } from "./notifications.service";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("notifications")
@ApiTags("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get user notifications" })
  @ApiQuery({ name: "unreadOnly", required: false, type: Boolean })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "before", required: false, description: "Notification ID for pagination" })
  @ApiResponse({ status: 200, description: "Returns list of notifications" })
  async getNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query("unreadOnly") unreadOnly?: string,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
  ) {
    return this.notificationsService.getUserNotifications(user.id, {
      unreadOnly: unreadOnly === "true",
      limit: limit ? parseInt(limit, 10) : undefined,
      before,
    });
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get unread notification count" })
  @ApiResponse({ status: 200, description: "Returns unread count" })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount: count };
  }

  @Get("preferences")
  @ApiOperation({ summary: "Get notification preferences" })
  @ApiResponse({ status: 200, description: "Returns notification preferences" })
  async getPreferences(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put("preferences")
  @ApiOperation({ summary: "Update notification preferences" })
  @ApiResponse({ status: 200, description: "Preferences updated successfully" })
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.id, dto.preferences);
  }

  @Put(":id/read")
  @ApiOperation({ summary: "Mark notification as read" })
  @ApiResponse({ status: 200, description: "Notification marked as read" })
  async markAsRead(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.notificationsService.markAsRead(id, user.id);
    return { success: true };
  }

  @Put("read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  @ApiResponse({ status: 200, description: "All notifications marked as read" })
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a notification" })
  @ApiResponse({ status: 200, description: "Notification deleted" })
  async deleteNotification(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.notificationsService.deleteNotification(id, user.id);
    return { success: true };
  }
}
