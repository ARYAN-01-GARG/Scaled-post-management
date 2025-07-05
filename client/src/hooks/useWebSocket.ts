'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

interface UseWebSocketProps {
  url?: string;
  userId?: string;
  onNotification?: (notification: Notification) => void;
  onNotificationCount?: (count: number) => void;
}

export const useWebSocket = ({
  url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  userId,
  onNotification,
  onNotificationCount,
}: UseWebSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const newSocket = io(url, {
      query: { userId },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Join notifications room
      newSocket.emit('join-notifications', { userId });
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('notification', (notification) => {
      console.log('New notification:', notification);
      onNotification?.(notification);
    });

    newSocket.on('notification-count', ({ unreadCount }) => {
      console.log('Notification count:', unreadCount);
      onNotificationCount?.(unreadCount);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    return () => {
      newSocket.close();
    };
  }, [url, userId, onNotification, onNotificationCount]);

  const markAsRead = (notificationId: string) => {
    if (socket && userId) {
      socket.emit('mark-notification-read', { notificationId, userId });
    }
  };

  return {
    socket,
    connected,
    markAsRead,
  };
};
