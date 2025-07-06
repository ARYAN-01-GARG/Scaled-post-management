import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  GetCommentsQueryDto,
} from './dto/comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async create(createCommentDto: CreateCommentDto, authorId: string) {
    const { postId, parentId, body } = createCommentDto;

    // Verify post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
      include: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Verify parent comment exists if parentId is provided
    if (parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentId, deletedAt: null },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    // Create comment
    const comment = await this.prisma.comment.create({
      data: {
        body,
        postId,
        parentId,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Send real-time notification
    await this.sendNotification(comment, post);

    return comment;
  }

  async findByPost(postId: string, query: GetCommentsQueryDto) {
    const { tree, page = 1, limit = 20, cursor } = query;

    // Verify post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (tree) {
      return this.getCommentTree(postId);
    } else {
      return this.getCommentFlat(postId, page, limit, cursor);
    }
  }

  async update(id: string, updateCommentDto: UpdateCommentDto, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id, deletedAt: null },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    // Check if comment is within edit window (15 minutes)
    const now = new Date();
    const commentAge = now.getTime() - comment.createdAt.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (commentAge > fifteenMinutes) {
      throw new ForbiddenException('Comments can only be edited within 15 minutes');
    }

    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id, deletedAt: null },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Check if comment is within delete window (15 minutes)
    const now = new Date();
    const commentAge = now.getTime() - comment.createdAt.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (commentAge > fifteenMinutes) {
      throw new ForbiddenException('Comments can only be deleted within 15 minutes');
    }

    // Soft delete
    return this.prisma.comment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async restore(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only restore your own comments');
    }

    if (!comment.deletedAt) {
      throw new BadRequestException('Comment is not deleted');
    }

    // Check if comment is within restore window (15 minutes from deletion)
    const now = new Date();
    const deletionAge = now.getTime() - comment.deletedAt.getTime();
    const fifteenMinutes = 15 * 60 * 1000;

    if (deletionAge > fifteenMinutes) {
      throw new ForbiddenException('Comments can only be restored within 15 minutes of deletion');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  private async getCommentTree(postId: string) {
    // Using raw SQL with recursive CTE for efficient tree retrieval
    const comments = await this.prisma.$queryRaw`
      WITH RECURSIVE comment_tree AS (
        -- Base case: top-level comments
        SELECT 
          id, "postId", "parentId", body, "authorId", "deletedAt", "createdAt", "updatedAt",
          0 as depth,
          ARRAY[id] as path
        FROM comments 
        WHERE "postId" = ${postId} AND "parentId" IS NULL AND "deletedAt" IS NULL
        
        UNION ALL
        
        -- Recursive case: child comments
        SELECT 
          c.id, c."postId", c."parentId", c.body, c."authorId", c."deletedAt", c."createdAt", c."updatedAt",
          ct.depth + 1,
          ct.path || c.id
        FROM comments c
        INNER JOIN comment_tree ct ON c."parentId" = ct.id
        WHERE c."deletedAt" IS NULL
      )
      SELECT ct.*, 
             u.name as author_name,
             u.email as author_email,
             u.avatar as author_avatar
      FROM comment_tree ct
      JOIN users u ON ct."authorId" = u.id
      ORDER BY path;
    `;

    return this.buildTree(comments as any[]);
  }

  private async getCommentFlat(postId: string, page: number, limit: number, cursor?: string) {
    const where: any = {
      postId,
      deletedAt: null,
    };

    if (cursor) {
      where.id = {
        lt: cursor,
      };
    }

    const comments = await this.prisma.comment.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            replies: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
    });

    const hasNextPage = comments.length > limit;
    if (hasNextPage) {
      comments.pop();
    }

    const nextCursor = hasNextPage ? comments[comments.length - 1]?.id : null;

    return {
      comments,
      hasNextPage,
      nextCursor,
    };
  }

  private buildTree(flatComments: any[]): any[] {
    const commentMap = new Map();
    const rootComments: any[] = [];

    // First pass: create comment objects with children array
    flatComments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        author: {
          id: comment.authorId,
          name: comment.author_name,
          email: comment.author_email,
          avatar: comment.author_avatar,
        },
        children: [],
      });
    });

    // Second pass: build the tree structure
    flatComments.forEach(comment => {
      const commentObj = commentMap.get(comment.id);
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.children.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    });

    return rootComments;
  }

  private async sendNotification(comment: any, post: any) {
    try {
      let notificationData;

      if (comment.parentId) {
        // Reply to comment
        const parentComment = await this.prisma.comment.findUnique({
          where: { id: comment.parentId },
          include: { author: true },
        });

        if (parentComment && parentComment.authorId !== comment.authorId) {
          notificationData = {
            userId: parentComment.authorId,
            type: 'comment_reply',
            title: 'New reply to your comment',
            message: `${comment.author.name || comment.author.email} replied to your comment`,
            data: {
              postId: post.id,
              commentId: comment.id,
              parentCommentId: comment.parentId,
            },
          };
        }
      } else {
        // Reply to post
        if (post.authorId !== comment.authorId) {
          notificationData = {
            userId: post.authorId,
            type: 'post_reply',
            title: 'New comment on your post',
            message: `${comment.author.name || comment.author.email} commented on your post`,
            data: {
              postId: post.id,
              commentId: comment.id,
            },
          };
        }
      }

      if (notificationData) {
        // Save notification to database
        await this.prisma.notification.create({
          data: notificationData,
        });

        // Send real-time notification via Redis
        await this.redisService.publish(
          `notifications:${notificationData.userId}`,
          JSON.stringify(notificationData),
        );
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}
