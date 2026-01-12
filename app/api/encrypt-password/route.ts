import { NextRequest, NextResponse } from 'next/server'
import { encrypt } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    const encrypted = encrypt(password)

    return NextResponse.json({ encrypted })
  } catch (error) {
    console.error('Error encrypting password:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to encrypt password' },
      { status: 500 }
    )
  }
}
