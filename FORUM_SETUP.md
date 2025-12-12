# Forum Setup Guide

## Overview

DaemonFetch now includes a full-featured forum system with:
- ✅ User accounts with avatars
- ✅ Three categories: Design, Education, Art
- ✅ Thread creation and posting
- ✅ Image/GIF attachments
- ✅ MySQL database storage
- ✅ NextAuth authentication

## Prerequisites

- MySQL server running locally or remotely
- Node.js 18+
- pnpm (or npm)

## Step 1: Database Setup

### Option A: Local MySQL (Recommended for Development)

1. **Install MySQL** (if not installed):
   ```bash
   # macOS
   brew install mysql
   brew services start mysql
   
   # Ubuntu/Debian
   sudo apt install mysql-server
   sudo systemctl start mysql
   ```

2. **Create database**:
   ```bash
   mysql -u root -p
   ```
   
   ```sql
   CREATE DATABASE daemonfetch;
   CREATE USER 'daemonfetch'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON daemonfetch.* TO 'daemonfetch'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

### Option B: Cloud MySQL (PlanetScale, Railway, etc.)

1. Sign up for a service
2. Create a new database
3. Copy the connection string

## Step 2: Environment Configuration

1. **Update `.env.local`**:
   ```bash
   # Database
   DATABASE_URL="mysql://daemonfetch:your_password@localhost:3306/daemonfetch"
   
   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_secret_here_generate_with_openssl
   ```

2. **Generate NextAuth secret**:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output to `NEXTAUTH_SECRET`

## Step 3: Initialize Database

1. **Generate Prisma client**:
   ```bash
   pnpm db:generate
   ```

2. **Push schema to database**:
   ```bash
   pnpm db:push
   ```

3. **Seed categories** (Design, Education, Art):
   ```bash
   pnpm db:seed
   ```

## Step 4: Start Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000/forum` to see the forum!

## Features

### User Management

**Registration** (`/forum/register`):
- Username (unique)
- Email (unique)
- Password (min 6 characters)
- Auto-generated avatar placeholder

**Login** (`/forum/login`):
- Email + Password authentication
- Session management with NextAuth

**Profile Settings**:
- Update avatar (upload image)
- Change username
- Edit bio

### Forum Categories

Three default categories:

1. **🎨 Design**
   - UI/UX design
   - Graphics
   - Creative concepts

2. **📚 Education**
   - Knowledge sharing
   - Tutorials
   - Learning resources

3. **🖼️ Art**
   - Artwork showcase
   - Digital art
   - Creative expression

### Threads & Posts

**Create Thread**:
- Title (required)
- Category (required)
- First post content (required)
- Attachments (optional)

**Reply to Thread**:
- Post content (required)
- Attachments (optional - images/GIFs)
- View count tracking
- Chronological ordering

**Attachments**:
- Supported: JPEG, PNG, GIF, WebP
- Max size: 5MB per file
- Stored in `/public/uploads`
- Auto-generated unique filenames

## Database Schema

### Tables

**users**:
- id, username, email, password (hashed)
- avatar, bio
- timestamps

**categories**:
- id, name, slug, description
- icon, order
- timestamps

**threads**:
- id, title, slug
- categoryId, authorId
- isPinned, isLocked, viewCount
- timestamps

**posts**:
- id, content, attachments (JSON)
- threadId, authorId
- isEdited
- timestamps

## API Endpoints

### Authentication

```bash
POST /api/auth/register
Body: { username, email, password }

POST /api/auth/[...nextauth]
# NextAuth endpoints (login, logout, session)
```

### Forum

```bash
GET /api/forum/categories
# List all categories

GET /api/forum/threads?categoryId=xxx
# List threads (optionally filtered by category)

POST /api/forum/threads
Body: { title, categoryId, content }
Auth: Required

GET /api/forum/threads/[id]
# Get thread with all posts

POST /api/forum/posts
Body: { threadId, content, attachments? }
Auth: Required

POST /api/upload
Body: FormData with 'file'
Auth: Required
Returns: { url: "/uploads/filename.ext" }
```

## Usage Examples

### Register a User

```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'alice',
    email: 'alice@example.com',
    password: 'securepass123'
  })
})
```

### Create a Thread

```typescript
const response = await fetch('/api/forum/threads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My First Thread',
    categoryId: 'category_id_here',
    content: 'Hello everyone!'
  })
})
```

### Upload Image

```typescript
const formData = new FormData()
formData.append('file', imageFile)

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
})

const { url } = await response.json()
// url = "/uploads/1234567890-abc.jpg"
```

### Create Post with Image

```typescript
// First upload image
const imageUrl = await uploadImage(file)

// Then create post
await fetch('/api/forum/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    threadId: 'thread_id_here',
    content: 'Check out this image!',
    attachments: [imageUrl]
  })
})
```

## Database Management

### View Data (Prisma Studio)

```bash
pnpm db:studio
```

Opens GUI at `http://localhost:5555`

### Migrations

```bash
# Create migration
pnpm db:migrate

# Reset database
npx prisma migrate reset

# Re-seed after reset
pnpm db:seed
```

### Backup

```bash
mysqldump -u daemonfetch -p daemonfetch > backup.sql
```

### Restore

```bash
mysql -u daemonfetch -p daemonfetch < backup.sql
```

## Troubleshooting

### "Database connection failed"

**Check:**
- MySQL server is running
- DATABASE_URL is correct
- User has permissions
- Database exists

```bash
# Test connection
mysql -u daemonfetch -p -h localhost daemonfetch
```

### "Prisma Client not generated"

```bash
pnpm db:generate
```

### "NextAuth error"

**Check:**
- NEXTAUTH_SECRET is set
- NEXTAUTH_URL matches your domain
- Session strategy is JWT

### "Upload failed"

**Check:**
- `/public/uploads` directory exists
- Write permissions on directory
- File size under 5MB
- File type is allowed (images only)

## Security Considerations

### Production Deployment

1. **Environment Variables**:
   ```bash
   DATABASE_URL=<production_db_url>
   NEXTAUTH_URL=https://yourdomain.com
   NEXTAUTH_SECRET=<strong_random_secret>
   ```

2. **Database**:
   - Use connection pooling
   - Enable SSL for connections
   - Regular backups
   - Proper user permissions

3. **File Uploads**:
   - Consider cloud storage (S3, Cloudinary)
   - Implement virus scanning
   - Add rate limiting
   - Validate file types strictly

4. **Authentication**:
   - Enable HTTPS
   - Implement rate limiting on login
   - Add CAPTCHA for registration
   - Email verification (optional)

## Extending the Forum

### Add New Category

```typescript
await prisma.category.create({
  data: {
    name: 'Technology',
    slug: 'technology',
    description: 'Tech discussions',
    icon: '💻',
    order: 4
  }
})
```

### Add User Roles

Update schema:
```prisma
model User {
  // ... existing fields
  role      String @default("user") // user, moderator, admin
}
```

### Add Reactions/Likes

Add table:
```prisma
model PostReaction {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  type      String   // like, love, etc
  createdAt DateTime @default(now())
  
  post      Post     @relation(fields: [postId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([postId, userId, type])
}
```

### Add Notifications

Add table:
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // reply, mention, etc
  content   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}
```

## Performance Optimization

### Database Indexes

Already included in schema:
- Username, email (unique)
- Category slug
- Thread categoryId, authorId
- Post threadId, authorId

### Caching

Consider adding:
- Redis for session storage
- CDN for uploaded images
- API route caching

### Pagination

Implement for:
- Thread lists (20 per page)
- Post lists (50 per page)
- User search

## Support

For issues:
- Check logs: `console.log` in API routes
- Inspect database: `pnpm db:studio`
- Review Prisma docs: https://www.prisma.io/docs

---

**Forum Status:** ✅ Ready for Development

**Last Updated:** December 12, 2024
