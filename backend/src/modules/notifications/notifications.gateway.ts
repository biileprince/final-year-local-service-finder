import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Inject, Logger, forwardRef } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { NotificationsService } from "./notifications.service";
import { MetricsService } from "../../monitoring/metrics.service";
import { getAllowedOrigins } from "../../common/security/cors";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
  namespace: "notifications",
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly metricsService: MetricsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });

      client.userId = payload.sub;

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      client.join(`user:${payload.sub}`);
      this.metricsService.wsConnectionsActive.inc();

      const unreadCount = await this.notificationsService.getUnreadCount(
        payload.sub,
      );
      client.emit("unread_count", unreadCount);
    } catch (error) {
      this.logger.error(
        `Connection authentication failed: ${(error as Error).message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const set = this.userSockets.get(client.userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) this.userSockets.delete(client.userId);
      }
    }
    this.metricsService.wsConnectionsActive.dec();
  }

  @SubscribeMessage("mark_read")
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    payload: { id: string },
  ) {
    if (!client.userId) return { error: "Not authenticated" };
    try {
      await this.notificationsService.markAsRead(payload.id, client.userId);
      const unread = await this.notificationsService.getUnreadCount(
        client.userId,
      );
      this.server.to(`user:${client.userId}`).emit("unread_count", unread);
      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  @SubscribeMessage("mark_all_read")
  async handleMarkAllRead(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return { error: "Not authenticated" };
    try {
      await this.notificationsService.markAllAsRead(client.userId);
      this.server.to(`user:${client.userId}`).emit("unread_count", 0);
      return { success: true };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  async emitNewNotification(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit("new_notification", notification);
    const unread = await this.notificationsService.getUnreadCount(userId);
    this.server.to(`user:${userId}`).emit("unread_count", unread);
  }

  async emitUnreadCount(userId: string) {
    const unread = await this.notificationsService.getUnreadCount(userId);
    this.server.to(`user:${userId}`).emit("unread_count", unread);
  }
}
