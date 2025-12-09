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

    return NextResponse.json({ 
      imageUrl: imageData,
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
