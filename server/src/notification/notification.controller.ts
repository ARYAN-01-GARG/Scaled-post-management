import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  Query,
  Post,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { RedisService } from '../redis/redis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getNotifications(
    @GetUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.notificationService.getNotifications(user.id, pageNum, limitNum);
  }

  @Get('unread-count')
  getUnreadCount(@GetUser() user: any) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @GetUser() user: any) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Patch('mark-all-read')
  markAllAsRead(@GetUser() user: any) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Delete(':id')
  deleteNotification(@Param('id') id: string, @GetUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.notificationService.deleteNotification(id, user.id);
  }

  // Temporary test endpoint - remove in production
  @Post('test')
  @UseGuards(JwtAuthGuard)
  async createTestNotification(@GetUser() user: any) {
    try {
      // Create a test notification
      const notification = await this.notificationService.create({
        userId: user.id,
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working!',
        data: { test: true, timestamp: new Date().toISOString() },
      });

      // Send via Redis for real-time delivery
      await this.redisService.publish(
        `notifications:${user.id}`,
        JSON.stringify(notification),
      );

      return {
        success: true,
        message: 'Test notification created and sent',
        notification,
      };
    } catch (error) {
      console.error('Test notification error:', error);
      throw new Error('Failed to create test notification');
    }
  }
}
