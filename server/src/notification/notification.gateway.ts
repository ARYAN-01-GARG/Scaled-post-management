import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from './notification.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private redisService: RedisService,
    private notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.initializeRedisSubscriber();
  }

  handleConnection(client: Socket) {
    try {
      // Extract user ID from token (you might need to implement JWT verification for WebSocket)
      const userId = this.extractUserIdFromSocket(client);
      console.log(
        `WebSocket connection attempt - userId: ${userId}, socketId: ${client.id}`,
      );
      if (userId) {
        // Add socket to user's socket set
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)?.add(client.id);

        console.log(`User ${userId} connected with socket ${client.id}`);
        // Don't disconnect here, let the client handle joining rooms
      } else {
        console.log(
          `Connection rejected - no userId provided for socket ${client.id}`,
        );
        client.disconnect();
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const userId = this.extractUserIdFromSocket(client);
      if (userId) {
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(client.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
        console.log(`User ${userId} disconnected socket ${client.id}`);
      }
    } catch (error) {
      console.error('WebSocket disconnection error:', error);
    }
  }

  @SubscribeMessage('join-notifications')
  async handleJoinNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      console.log(
        `Join notifications request from socket ${client.id} for user ${data.userId}`,
      );
      await client.join(`notifications:${data.userId}`);
      console.log(
        `Socket ${client.id} joined room notifications:${data.userId}`,
      );

      // Get actual unread count from database
      const unreadCount = await this.notificationService.getUnreadCount(
        data.userId,
      );
      console.log(`Sending unread count ${unreadCount} to socket ${client.id}`);
      client.emit('notification-count', { unreadCount });
      console.log(
        `Successfully processed join-notifications for socket ${client.id}`,
      );
    } catch (error) {
      console.error('Join notifications error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
    }
  }

  @SubscribeMessage('mark-notification-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string; userId: string },
  ) {
    try {
      await this.notificationService.markAsRead(
        data.notificationId,
        data.userId,
      );
      const unreadCount = await this.notificationService.getUnreadCount(
        data.userId,
      );
      // Send updated count to all user's sockets
      this.server
        .to(`notifications:${data.userId}`)
        .emit('notification-count', { unreadCount });
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  }

  private async initializeRedisSubscriber() {
    try {
      // Subscribe to all notification channels
      await this.redisService.subscribe(
        'notifications:*',
        (message: string) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const notification = JSON.parse(message);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            void this.sendNotificationToUser(notification.userId, notification);
          } catch (error) {
            console.error('Redis message parsing error:', error);
          }
        },
      );
    } catch (error) {
      console.error('Redis subscriber initialization error:', error);
    }
  }

  private async sendNotificationToUser(userId: string, notification: any) {
    try {
      // Send to all sockets for this user
      this.server
        .to(`notifications:${userId}`)
        .emit('notification', notification);

      // Also send updated count
      try {
        const unreadCount =
          await this.notificationService.getUnreadCount(userId);
        this.server
          .to(`notifications:${userId}`)
          .emit('notification-count', { unreadCount });
      } catch (error) {
        console.error('Error getting unread count:', error);
      }
    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  private extractUserIdFromSocket(client: Socket): string | null {
    try {
      // Extract from handshake query or auth token
      // This is a simplified implementation - you should implement proper JWT verification
      return (client.handshake.query.userId as string) || null;
    } catch (error) {
      console.error('Extract user ID error:', error);
      return null;
    }
  }
}
