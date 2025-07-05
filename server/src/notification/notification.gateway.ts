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
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from './notification.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private redisService: RedisService,
    private notificationService: NotificationService,
  ) {
    this.initializeRedisSubscriber();
  }

  async handleConnection(client: Socket) {
    try {
      // Extract user ID from token (you might need to implement JWT verification for WebSocket)
      const userId = this.extractUserIdFromSocket(client);
      if (userId) {
        // Add socket to user's socket set
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)?.add(client.id);

        console.log(`User ${userId} connected with socket ${client.id}`);
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
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
  @UseGuards(JwtAuthGuard)
  async handleJoinNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      client.join(`notifications:${data.userId}`);
      
      // Send current unread count
      const unreadCount = await this.notificationService.getUnreadCount(data.userId);
      client.emit('notification-count', { unreadCount });
    } catch (error) {
      console.error('Join notifications error:', error);
    }
  }

  @SubscribeMessage('mark-notification-read')
  @UseGuards(JwtAuthGuard)
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string; userId: string },
  ) {
    try {
      await this.notificationService.markAsRead(data.notificationId, data.userId);
      const unreadCount = await this.notificationService.getUnreadCount(data.userId);
      
      // Send updated count to all user's sockets
      this.server.to(`notifications:${data.userId}`).emit('notification-count', { unreadCount });
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  }

  private async initializeRedisSubscriber() {
    try {
      // Subscribe to all notification channels
      await this.redisService.subscribe('notifications:*', (message: string) => {
        try {
          const notification = JSON.parse(message);
          this.sendNotificationToUser(notification.userId, notification);
        } catch (error) {
          console.error('Redis message parsing error:', error);
        }
      });
    } catch (error) {
      console.error('Redis subscriber initialization error:', error);
    }
  }

  private sendNotificationToUser(userId: string, notification: any) {
    try {
      // Send to all sockets for this user
      this.server.to(`notifications:${userId}`).emit('notification', notification);
      
      // Also send updated count
      this.notificationService.getUnreadCount(userId).then(unreadCount => {
        this.server.to(`notifications:${userId}`).emit('notification-count', { unreadCount });
      });
    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  private extractUserIdFromSocket(client: Socket): string | null {
    try {
      // Extract from handshake query or auth token
      // This is a simplified implementation - you should implement proper JWT verification
      return client.handshake.query.userId as string || null;
    } catch (error) {
      console.error('Extract user ID error:', error);
      return null;
    }
  }
}
