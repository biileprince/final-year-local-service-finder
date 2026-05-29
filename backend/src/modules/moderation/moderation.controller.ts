import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { ModerationService } from "./moderation.service";
import { CreateReportDto } from "./dto/create-report.dto";

@ApiTags("moderation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("moderation")
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get("blocks")
  @ApiOperation({ summary: "List users the current user has blocked" })
  async listBlocks(@CurrentUser() user: CurrentUserPayload) {
    return this.moderationService.listBlocks(user.id);
  }

  @Get("block-status/:userId")
  @ApiOperation({ summary: "Block status between caller and another user" })
  async blockStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param("userId") userId: string,
  ) {
    return this.moderationService.getBlockStatus(user.id, userId);
  }

  @Post("block/:userId")
  @ApiOperation({ summary: "Block a user" })
  @ApiResponse({ status: 201, description: "Blocked (or already blocked)" })
  async block(
    @CurrentUser() user: CurrentUserPayload,
    @Param("userId") userId: string,
  ) {
    return this.moderationService.blockUser(user.id, userId);
  }

  @Delete("block/:userId")
  @ApiOperation({ summary: "Unblock a user" })
  async unblock(
    @CurrentUser() user: CurrentUserPayload,
    @Param("userId") userId: string,
  ) {
    return this.moderationService.unblockUser(user.id, userId);
  }

  @Post("report")
  @ApiOperation({ summary: "Report a user (optionally from a conversation)" })
  @ApiResponse({ status: 201, description: "Report filed" })
  async report(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReportDto,
  ) {
    return this.moderationService.createReport(user.id, dto);
  }
}
