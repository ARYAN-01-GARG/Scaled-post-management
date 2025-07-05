'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';
import { User, LogOut, Home, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Notifications } from './Notifications';
import { notificationsAPI } from '../lib/api';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: {
    postId?: string;
    commentId?: string;
    parentCommentId?: string;
  };
  read: boolean;
  createdAt: string;
}

export function Navigation() {
  const { user, logout, isAuthenticated } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch notifications when component mounts
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchNotifications();
    }
  }, [isAuthenticated, user?.id]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsAPI.getAll(1, 20);
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleNewNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setNotificationCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  useWebSocket({
    userId: user?.id,
    onNotificationCount: (count) => setNotificationCount(count),
    onNewNotification: handleNewNotification,
  });

  if (!isAuthenticated) {
    return (
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                Comment System
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Register</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Comment System
            </Link>
            <Link href="/" className="flex items-center text-gray-500 hover:text-gray-900">
              <Home className="w-4 h-4 mr-2" />
              Posts
            </Link>
            <Link href="/posts/create" className="flex items-center text-gray-500 hover:text-gray-900">
              <Plus className="w-4 h-4 mr-2" />
              Create Post
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Notifications
              notifications={notifications}
              unreadCount={notificationCount}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
            />
            
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span className="text-sm text-gray-700">{user?.name || user?.email}</span>
            </div>
            
            <Button
              variant="outline"
              onClick={logout}
              className="flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
