import { NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'

// Initialize the Dodo server client
const apiKey = process.env.dodo_api_key || ''
const client = new DodoPayments({
  bearerToken: apiKey,
  environment: apiKey.toLowerCase().includes('test') ? 'test_mode' : 'live_mode',
})

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin') || 'http://localhost:3000'
    const productId = process.env.product_id

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
