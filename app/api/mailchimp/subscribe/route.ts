import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.MAILCHIMP_API_KEY
    const datacenter = process.env.MAILCHIMP_DATACENTER
    const listId = process.env.MAILCHIMP_LIST_ID

    if (!apiKey || !datacenter || !listId) {
      console.error('[Mailchimp] Missing configuration:', {
        hasApiKey: !!apiKey,
        hasDatacenter: !!datacenter,
        hasListId: !!listId,
      })
      return NextResponse.json(
        { success: false, error: 'Email service not configured' },
        { status: 500 }
      )
    }

    // Mailchimp API endpoint
    const url = `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed', // or 'pending' for double opt-in
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      
      // Handle duplicate email (already subscribed)
      if (response.status === 400 && errorData.title === 'Member Exists') {
        return NextResponse.json(
          { success: true, message: 'You are already subscribed!' },
          { status: 200 }
        )
      }

      console.error('[Mailchimp] API error:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.detail || 'Failed to subscribe' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed!',
      data,
    })
  } catch (error) {
    console.error('[Mailchimp] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      },
      { status: 500 }
    )
  }
}



