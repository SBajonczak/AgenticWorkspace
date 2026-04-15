import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserTokenService } from '@/graph/userTokenService'

interface SessionUserLike {
  id?: string
}

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionUser = session.user as SessionUserLike
  if (!sessionUser.id) {
    return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
  }

  try {
    const userTokenService = new UserTokenService()
    const accessToken = await userTokenService.getValidAccessTokenForUser(sessionUser.id)

    const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    if (!photoResponse.ok) {
      if (photoResponse.status === 404) {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
      }

      return NextResponse.json({ error: 'Failed to load profile photo' }, { status: photoResponse.status })
    }

    const contentType = photoResponse.headers.get('content-type') ?? 'image/jpeg'
    const imageBuffer = await photoResponse.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/user/me/photo] Failed to load profile photo', error)
    return NextResponse.json({ error: 'Failed to load profile photo' }, { status: 500 })
  }
}
