import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // AI generation feature is disabled via codebase
  return NextResponse.json(
    { 
      error: 'Feature Disabled',
      message: 'AI image generation has been disabled in this project.',
    },
    { status: 400 }
  )
}
