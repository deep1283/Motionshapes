import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt, baseImage } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    // Build the request parts
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
    
    // If editing an existing image, include it first
    if (baseImage) {
      // Extract base64 data (remove data URL prefix if present)
      const base64Data = baseImage.replace(/^data:image\/\w+;base64,/, '')
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data
        }
      })
      parts.push({ text: `Edit this image: ${prompt}` })
    } else {
      parts.push({ text: `Generate an image: ${prompt}` })
    }

    // Call Gemini 2.0 Flash with image generation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      return NextResponse.json({ error: 'Failed to generate image', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    
    // Extract the image from the response
    const candidates = data.candidates || []
    const content = candidates[0]?.content
    const responseParts = content?.parts || []
    
    let imageData: string | null = null
    let textResponse: string | null = null
    
    for (const part of responseParts) {
      if (part.inlineData?.data) {
        imageData = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
      }
      if (part.text) {
        textResponse = part.text
      }
    }

    if (!imageData) {
      return NextResponse.json({ 
        error: 'No image generated', 
        textResponse,
        rawResponse: data 
      }, { status: 500 })
    }

    // Upload to R2 if configured, otherwise return base64
    let finalImageUrl = imageData
    if (process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        
        const r2Client = new S3Client({
          region: 'auto',
          endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
          },
        })

        // Extract base64 data
        const matches = imageData.match(/^data:(.+);base64,(.+)$/)
        if (matches) {
          const mimeType = matches[1]
          const base64Data = matches[2]
          const buffer = Buffer.from(base64Data, 'base64')
          const extension = mimeType.split('/')[1] || 'png'
          const key = `ai-generated/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`

          await r2Client.send(new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
          }))

          finalImageUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
        }
      } catch (r2Error) {
        console.error('R2 upload failed, using base64 fallback:', r2Error)
        // Keep using base64 as fallback
      }
    }

    return NextResponse.json({ 
      imageUrl: finalImageUrl,
      textResponse 
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
