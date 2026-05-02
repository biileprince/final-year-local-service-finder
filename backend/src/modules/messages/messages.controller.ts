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
import { MessagesService } from "./messages.service";
import { StartConversationDto } from "./dto/start-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";

@Controller("messages")
@ApiTags("messages")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post("conversations")
  @ApiOperation({
    summary: "Start or get existing conversation with a provider",
  })
  @ApiResponse({ status: 201, description: "Conversation created/retrieved" })
  async startConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StartConversationDto,
  ) {
    return this.messagesService.getOrCreateConversation(
      user.id,
      dto.providerId,
      dto.bookingId,
    );
  }

  @Get("conversations")
  @ApiOperation({ summary: "Get all user conversations" })
  async getConversations(@CurrentUser() user: CurrentUserPayload) {
    return this.messagesService.getUserConversations(user.id);
  }

  @Get("conversations/:id")
  @ApiOperation({ summary: "Get conversation by ID" })
  @ApiResponse({ status: 200, description: "Returns conversation details" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async getConversation(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.messagesService.getConversation(id, user.id);
  }

  @Get("conversations/:id/messages")
  @ApiOperation({ summary: "Get messages in a conversation" })
  @ApiQuery({
    name: "before",
    required: false,
    description: "Message ID for pagination",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getMessages(
    @Param("id") conversationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query("before") before?: string,
    @Query("limit") limit?: number,
  ) {
    return this.messagesService.getMessages(conversationId, user.id, {
      before,
      limit,
    });
  }

  @Post("conversations/:id/messages")
  @ApiOperation({ summary: "Send a message" })
  @ApiResponse({ status: 201, description: "Message sent successfully" })
  async sendMessage(
    @Param("id") conversationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      conversationId,
      user.id,
      dto.content,
      dto.messageType,
      dto.fileId,
    );
  }

  @Put("conversations/:id/read")
  @ApiOperation({ summary: "Mark conversation as read" })
  async markAsRead(
    @Param("id") conversationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.messagesService.markAsRead(conversationId, user.id);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get unread message count" })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    return this.messagesService.getUnreadCount(user.id);
  }

  @Put(":messageId")
  @ApiOperation({ summary: "Edit a message" })
  async editMessage(
    @Param("messageId") messageId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body("content") content: string,
  ) {
    return this.messagesService.editMessage(messageId, user.id, content);
  }

  @Delete(":messageId")
  @ApiOperation({ summary: "Delete a message" })
  async deleteMessage(
    @Param("messageId") messageId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.messagesService.deleteMessage(messageId, user.id);
  }
}
