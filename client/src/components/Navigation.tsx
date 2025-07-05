'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';
import { Bell, User, LogOut, Home, Plus } from 'lucide-react';
import { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export function Navigation() {
  const { user, logout, isAuthenticated } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  
  useWebSocket({
    userId: user?.id,
    onNotificationCount: (count) => setNotificationCount(count),
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
            <button className="relative p-2 text-gray-500 hover:text-gray-900">
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
            
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
