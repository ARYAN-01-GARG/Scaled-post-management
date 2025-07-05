'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { postsAPI, commentsAPI } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';

interface Post {
  id: string;
  title: string;
  content?: string;
  description?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  children?: Comment[];
}

export default function PostDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // WebSocket for real-time notifications
  const { connected } = useWebSocket({
    userId: user?.id,
    onNotification: (notification) => {
      console.log('New notification:', notification);
      // Refresh comments if it's related to this post
      if (notification.data?.postId === params.id) {
        loadComments();
      }
    },
  });

  const loadPost = async () => {
    try {
      const response = await postsAPI.getById(params.id as string);
      setPost(response.data);
    } catch (error) {
      console.error('Failed to load post:', error);
    }
  };

  const loadComments = async () => {
    try {
      const response = await commentsAPI.getByPost(params.id as string, { tree: true });
      setComments(response.data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadPost();
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      await commentsAPI.create({
        postId: params.id as string,
        body: newComment,
      });
      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyText.trim() || !user) return;

    try {
      await commentsAPI.create({
        postId: params.id as string,
        body: replyText,
        parentId,
      });
      setReplyText('');
      setReplyingTo(null);
      loadComments();
    } catch (error) {
      console.error('Failed to create reply:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className="mb-4">
      <div className={`bg-gray-50 p-4 rounded-lg ${depth > 0 ? 'ml-8' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="font-medium text-gray-900">
              {comment.author.name || comment.author.email}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              {formatDate(comment.createdAt)}
            </span>
            {comment.updatedAt !== comment.createdAt && (
              <span className="text-xs text-gray-400 ml-2">(edited)</span>
            )}
          </div>
          {user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplyingTo(comment.id)}
              className="text-xs"
            >
              Reply
            </Button>
          )}
        </div>
        <p className="text-gray-700 mb-3">{comment.body}</p>

        {replyingTo === comment.id && user && (
          <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md resize-none"
              rows={3}
              placeholder="Write a reply..."
              required
            />
            <div className="flex gap-2 mt-2">
              <Button type="submit" size="sm">Reply</Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
      
      {comment.children && comment.children.length > 0 && (
        <div className="mt-2">
          {comment.children.map((child) => renderComment(child, depth + 1))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Post not found</h1>
          <p className="text-gray-600">The post you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Post Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
        <div className="flex items-center text-sm text-gray-500 mb-6">
          <span className="font-medium">{post.author.name || post.author.email}</span>
          <span className="mx-2">•</span>
          <span>{formatDate(post.createdAt)}</span>
          {connected && (
            <>
              <span className="mx-2">•</span>
              <span className="text-green-500">Live</span>
            </>
          )}
        </div>
        {post.description && (
          <p className="text-lg text-gray-700 mb-4">{post.description}</p>
        )}
        {post.content && (
          <div className="prose max-w-none">
            <p className="text-gray-700">{post.content}</p>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Comments ({comments.length})
        </h2>

        {/* Add Comment Form */}
        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-8">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md resize-none"
              rows={4}
              placeholder="Write a comment..."
              required
            />
            <div className="flex justify-end mt-3">
              <Button type="submit">Post Comment</Button>
            </div>
          </form>
        ) : (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600">
              <a href="/login" className="text-blue-600 hover:underline">
                Sign in
              </a>{' '}
              to post a comment
            </p>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length > 0 ? (
            comments.map((comment) => renderComment(comment))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No comments yet. Be the first to comment!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
