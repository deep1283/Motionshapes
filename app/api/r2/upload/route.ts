import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const { imageData, fileName } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: 'Image data required' }, { status: 400 })
    }

    // Extract base64 data and mime type
    const matches = imageData.match(/^data:(.+);base64,(.+)$/)
    if (!matches) {
      return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 })
    }

    const mimeType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Generate unique filename
    const extension = mimeType.split('/')[1] || 'png'
    const key = fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`

    // Upload to R2
    await client.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }))

    // Return public URL
    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`

    return NextResponse.json({ 
      success: true,
      url: publicUrl,
      key 
    })

  } catch (error) {
    console.error('R2 upload error:', error)
    return NextResponse.json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
