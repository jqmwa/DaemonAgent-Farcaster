import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { threadId, content, attachments } = await req.json()

    if (!threadId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if thread exists and is not locked
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: { isLocked: true },
    })

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    if (thread.isLocked) {
      return NextResponse.json(
        { error: 'Thread is locked' },
        { status: 403 }
      )
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        content,
        attachments: attachments || null,
        threadId,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    })

    // Update thread's updatedAt
    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ post })
  } catch (error) {
    console.error('[Create Post Error]', error)
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
}
