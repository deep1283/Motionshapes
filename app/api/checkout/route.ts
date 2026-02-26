import { NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'

export async function POST(request: Request) {
  try {
    // Initialize inside the handler so env vars are always read fresh
    const apiKey = process.env.dodo_api_key || ''
    const productId = process.env.product_id

    if (!apiKey) {
      console.error('Dodo API key is missing from environment variables')
      return NextResponse.json(
        { error: 'Payment provider not configured' },
        { status: 500 }
      )
    }

    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: 'live_mode',
    })

    const origin = request.headers.get('origin') || 'http://localhost:3000'

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID not configured in environment parameters' },
        { status: 500 }
      )
    }

    // Create a robust server-side checkout session
    const session = await client.payments.create({
      billing: {
        city: 'Anonymous',
        country: 'IN', // Default to IN for smooth routing
        state: 'Anonymous',
        street: 'Anonymous',
        zipcode: '000000'
      },
      customer: {
        email: 'anonymous@sponsor.local',
        name: 'Anonymous Sponsor'
      },
      payment_link: true,
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: 900, // $9.00 minimum in cents for Pay What You Want
        }
      ],
      return_url: `${origin}/dashboard?sponsor=success`,
    })

    // Return the generated redirect link back to the client button
    return NextResponse.json({ url: session.payment_link })
    
  } catch (error: any) {
    console.error('Dodo checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create generic checkout session' },
      { status: 500 }
    )
  }
}
