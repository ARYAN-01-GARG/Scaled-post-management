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
import { RedisService } from '../redis/redis.service';
import { NotificationService } from './notification.service';
import { OnModuleInit } from '@nestjs/common';

interface RedisNotification {
  userId: string;
  id: string;
  type: string;
  message: string;
  metadata?: any;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  namespace: '/',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {

  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private redisService: RedisService,
    private notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    try {
      await this.initializeRedisSubscriber();
      console.log('✅ NotificationGateway initialized successfully');
    } catch (error) {
      console.error('❌ NotificationGateway initialization error:', error);
    }
  }

  handleConnection(client: Socket) {
    try {
      console.log(`🔌 WebSocket connection attempt - socketId: ${client.id}`);
      const userId = this.extractUserIdFromSocket(client);
      console.log(`👤 Extracted userId: ${userId}`);

      if (userId) {
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)?.add(client.id);
        console.log(`✅ User ${userId} connected with socket ${client.id}`);
      } else {
        console.log(`⚠️ WebSocket connection without userId, socketId: ${client.id}`);
      }
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
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
        console.log(`🔌 User ${userId} disconnected socket ${client.id}`);
      }
    } catch (error) {
      console.error('❌ WebSocket disconnection error:', error);
    }
  }

  @SubscribeMessage('join-notifications')
  async handleJoinNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      console.log('📨 Join notifications request received:', data);

      const userId = data.userId || this.extractUserIdFromSocket(client);
      if (!userId) {
        console.error('❌ No userId provided for join-notifications');
        client.emit('error', { message: 'UserId required' });
        return;
      }

      await client.join(`notifications:${userId}`);
      console.log(`🏠 Socket ${client.id} joined notifications:${userId}`);

      // Get and send current unread count
      const unreadCount = await this.notificationService.getUnreadCount(userId);
      client.emit('notification-count', { unreadCount });
      console.log(`🔔 Sent unread count ${unreadCount} to user ${userId}`);

      // Confirm successful join
      client.emit('joined-notifications', { success: true, userId });

    } catch (error) {
      console.error('❌ Join notifications error:', error);
      client.emit('error', { message: 'Failed to join notifications' });
    }
  }

  @SubscribeMessage('mark-notification-read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string; userId: string },
  ) {
    try {
      console.log('✅ Mark notification read request:', data);

      await this.notificationService.markAsRead(data.notificationId, data.userId);
      const unreadCount = await this.notificationService.getUnreadCount(data.userId);

      this.server.to(`notifications:${data.userId}`).emit('notification-count', { unreadCount });
      console.log(`🔄 Updated unread count for user ${data.userId}: ${unreadCount}`);

    } catch (error) {
      console.error('❌ Mark notification read error:', error);
    }
  }

  private async initializeRedisSubscriber() {
    try {
      await this.redisService.subscribe('notifications:*', (message: string) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const parsedData = JSON.parse(message);
            console.log('📬 Received notification via Redis:', parsedData);
            
            // Type guard for notification structure
            if (parsedData && typeof parsedData === 'object' && 'userId' in parsedData) {
              const notification = parsedData as RedisNotification;
              this.sendNotificationToUser(notification.userId, notification);
            } else {
              console.error('❌ Invalid notification structure:', parsedData);
            }
          } catch (error) {
            console.error('❌ Redis message parsing error:', error);
          }
        },
      );
      console.log('✅ Redis subscriber initialized successfully');
    } catch (error) {
      console.error('❌ Redis subscriber initialization error:', error);
    }
  }

  private sendNotificationToUser(userId: string, notification: any) {
    try {
      console.log(`📤 Sending notification to user ${userId}:`, notification);
      this.server.to(`notifications:${userId}`).emit('notification', notification);
      
      void this.notificationService.getUnreadCount(userId).then(unreadCount => {
        this.server.to(`notifications:${userId}`).emit('notification-count', { unreadCount });
        console.log(`🔔 Updated notification count for user ${userId}: ${unreadCount}`);
      });
    } catch (error) {
      console.error('❌ Send notification error:', error);
    }
  }

  private extractUserIdFromSocket(client: Socket): string | null {
    try {
      return (client.handshake.query.userId as string) || null;
    } catch (error) {
      console.error('❌ Extract user ID error:', error);
      return null;
    }
  }
}
