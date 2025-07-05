# 🛠️ Scalable Comment System

A highly scalable, Dockerized comment system built with modern technologies for handling infinite-level nested comments with real-time notifications.

## 🚀 Tech Stack

### Backend (NestJS)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (access + refresh tokens) with Argon2 hashing
- **Caching**: Redis for sessions and pub/sub
- **Real-time**: WebSocket with Socket.io
- **Queue**: BullMQ for background jobs
- **Validation**: class-validator and class-transformer

### Frontend (Next.js)
- **Framework**: Next.js 15 with App Router
- **UI**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Real-time**: Socket.io client for notifications
- **Forms**: React Hook Form with Zod validation

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose
- **Database**: PostgreSQL 15
- **Cache**: Redis 7

## ✨ Features

### 🔐 Authentication
- Email/password registration with Argon2 hashing
- JWT access tokens (15 min) and refresh tokens (7 days)
- Automatic token refresh and rotation
- Secure logout and session management

### 💬 Comment System
- **Infinite-level nested comments** using `parentId`
- **Soft delete** with `deletedAt` timestamp
- **Time-limited editing**: Edit/delete within 15 minutes
- **Recursive CTE** for efficient comment tree fetching
- **Flexible views**: Flat or tree view with query parameters
- **Pagination**: Cursor-based and page-based pagination

### 📢 Real-time Notifications
- WebSocket connections for instant notifications
- Redis pub/sub for scalable message distribution
- Notification types:
  - Comment replies
  - Post replies
- Unread notification counters
- Mark as read functionality

### 🎯 Post Management
- Create, read, update, delete posts
- Rich content support (title, description, content)
- Author attribution and timestamps
- Comment count tracking

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- PostgreSQL (if running locally)
- Redis (if running locally)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd scaled-post-management-system

# Copy environment files
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Update environment variables as needed
```

### 2. Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 3. Manual Setup (Development)

#### Backend Setup
```bash
cd server

# Install dependencies
npm install --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

#### Frontend Setup
```bash
cd client

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev
```

## 📊 Database Schema

### Core Models
- **User**: Authentication and profile data
- **Post**: Blog posts with title, content, description
- **Comment**: Nested comments with soft delete
- **RefreshToken**: JWT refresh token management
- **Notification**: Real-time notification system

### Key Relationships
- Users can create multiple posts and comments
- Comments belong to posts and can have parent comments
- Notifications are sent to users for comment/post replies
- Refresh tokens are tied to users for session management

## 🔧 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user profile

### Posts
- `GET /posts` - List posts (paginated)
- `GET /posts/:id` - Get single post
- `POST /posts` - Create new post
- `PUT /posts/:id` - Update post
- `DELETE /posts/:id` - Soft delete post

### Comments
- `GET /posts/:postId/comments` - Get post comments (tree/flat)
- `POST /comments` - Create comment
- `PUT /comments/:id` - Update comment (within 15 min)
- `DELETE /comments/:id` - Soft delete comment (within 15 min)
- `PATCH /comments/:id/restore` - Restore deleted comment (within 15 min)

### Notifications
- `GET /notifications` - Get user notifications
- `PATCH /notifications/:id/read` - Mark notification as read
- `PATCH /notifications/read-all` - Mark all notifications as read

## 🧰 Architecture Highlights

### Scalability Features
1. **Horizontal Scaling**: Stateless backend with Redis session storage
2. **Database Optimization**: Indexed queries and recursive CTEs
3. **Caching Layer**: Redis for frequently accessed data
4. **Message Queue**: BullMQ for background job processing
5. **Real-time**: Pub/sub pattern for WebSocket scaling

### Security Features
1. **Password Hashing**: Argon2 (winner of password hashing competition)
2. **JWT Security**: Short-lived access tokens with refresh rotation
3. **Input Validation**: Comprehensive DTO validation
4. **SQL Injection Prevention**: Prisma ORM with prepared statements
5. **CORS Configuration**: Proper cross-origin request handling

### Performance Features
1. **Connection Pooling**: Prisma connection management
2. **Query Optimization**: Selective field loading and joins
3. **Pagination**: Efficient cursor and offset-based pagination
4. **Soft Deletes**: Data retention without performance impact
5. **Indexes**: Strategic database indexing for common queries

## 🧪 Testing

### Backend Tests
```bash
cd server

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Frontend Tests
```bash
cd client

# Component tests
npm run test

# E2E tests with Playwright
npm run test:e2e
```

## 📝 Development Notes

### Comment Time Restrictions
- Comments can only be edited/deleted within 15 minutes of creation
- This is implemented both in the backend logic and frontend UI
- Restored comments must be within the 15-minute window

### Real-time Architecture
- WebSocket connections are user-specific
- Redis pub/sub enables horizontal scaling of WebSocket servers
- Notifications are queued and delivered reliably

### Database Patterns
- Soft deletes preserve data integrity
- Recursive CTEs handle arbitrary comment nesting
- Foreign key constraints maintain referential integrity

## 🚀 Production Deployment

### Environment Variables
Ensure all environment variables are properly set:
- Database connection strings
- JWT secrets (use strong, unique secrets)
- Redis configuration
- CORS origins
- OAuth credentials (if using)

### Security Checklist
- [ ] Strong JWT secrets
- [ ] HTTPS enabled
- [ ] Database credentials secured
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation enabled

### Monitoring
- Database query performance
- Redis memory usage
- WebSocket connection counts
- API response times
- Background job processing

## 📞 Support

For issues, feature requests, or questions:
1. Check existing documentation
2. Review the code structure
3. Create detailed issue reports
4. Include error logs and environment details

## 🎯 Future Enhancements

- [ ] File upload support for posts/comments
- [ ] Rich text editor integration
- [ ] Email notifications
- [ ] Comment moderation system
- [ ] Rate limiting and spam protection
- [ ] OAuth provider integration
- [ ] Mobile app support
- [ ] Analytics and metrics
- [ ] Content search functionality
- [ ] User reputation system

---

Built with ❤️ using modern web technologies for maximum scalability and performance.
