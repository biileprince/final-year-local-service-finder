import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { MessagesService } from "./messages.service";
import { MetricsService } from "../../monitoring/metrics.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  namespace: "messages",
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly metricsService: MetricsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });

      client.userId = payload.sub;
      client.userEmail = payload.email;

      // Track user sockets
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      // Join user's personal room
      client.join(`user:${payload.sub}`);

      this.logger.log(`Client ${client.id} connected as user ${payload.sub}`);
      this.metricsService.wsConnectionsActive.inc();

      // Send unread count on connect
      const unreadCount = await this.messagesService.getUnreadCount(payload.sub);
      client.emit("unread_count", unreadCount);
    } catch (error) {
      this.logger.error(`Connection authentication failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSocketSet = this.userSockets.get(client.userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }

    this.logger.log(`Client ${client.id} disconnected`);
    this.metricsService.wsConnectionsActive.dec();
  }

  @SubscribeMessage("join_conversation")
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) {
      return { error: "Not authenticated" };
    }

    try {
      // Verify user has access to conversation
      await this.messagesService.getConversation(data.conversationId, client.userId);

      // Join conversation room
      client.join(`conversation:${data.conversationId}`);

      this.logger.log(`User ${client.userId} joined conversation ${data.conversationId}`);

      // Mark messages as read
      await this.messagesService.markAsRead(data.conversationId, client.userId);

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage("leave_conversation")
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    this.logger.log(`User ${client.userId} left conversation ${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage("send_message")
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      messageType?: string;
      fileId?: string;
    },
  ) {
    if (!client.userId) {
      return { error: "Not authenticated" };
    }

    try {
      const message = await this.messagesService.sendMessage(
        data.conversationId,
        client.userId,
        data.content,
        data.messageType,
        data.fileId,
      );

      // Broadcast to conversation room
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit("new_message", message);

      // Notify other participant
      const participantIds = await this.messagesService.getParticipantIds(
        data.conversationId,
      );

      for (const participantId of participantIds) {
        if (participantId !== client.userId) {
          // Send to user's personal room for notification
          this.server.to(`user:${participantId}`).emit("message_notification", {
            conversationId: data.conversationId,
            message,
          });

          // Update unread count
          const unreadCount =
            await this.messagesService.getUnreadCount(participantId);
          this.server.to(`user:${participantId}`).emit("unread_count", unreadCount);
        }
      }

      this.metricsService.wsMessagesSent.inc({ event_type: "message" });

      return { success: true, message };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage("typing_start")
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    client.to(`conversation:${data.conversationId}`).emit("user_typing", {
      conversationId: data.conversationId,
      userId: client.userId,
      isTyping: true,
    });
  }

  @SubscribeMessage("typing_stop")
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) return;

    client.to(`conversation:${data.conversationId}`).emit("user_typing", {
      conversationId: data.conversationId,
      userId: client.userId,
      isTyping: false,
    });
  }

  @SubscribeMessage("mark_read")
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) {
      return { error: "Not authenticated" };
    }

    try {
      await this.messagesService.markAsRead(data.conversationId, client.userId);

      // Update unread count
      const unreadCount = await this.messagesService.getUnreadCount(client.userId);
      client.emit("unread_count", unreadCount);

      // Notify sender that messages were read
      this.server.to(`conversation:${data.conversationId}`).emit("messages_read", {
        conversationId: data.conversationId,
        readBy: client.userId,
        readAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Utility method to send notification to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Utility method to check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}
