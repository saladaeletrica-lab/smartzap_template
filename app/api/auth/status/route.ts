/**
 * Auth Status API
 * 
 * GET: Check current auth status (setup complete? authenticated? configured?)
 */

import { NextResponse } from 'next/server'
import { getUserAuthStatus } from '@/lib/user-auth'

export const runtime = 'edge'

export async function GET() {
  try {
    console.log('🔍 [AUTH-STATUS] === START ===')
    // Check if MASTER_PASSWORD is configured
    console.log('🔍 [AUTH-STATUS] MASTER_PASSWORD exists:', !!process.env.MASTER_PASSWORD)
    console.log('🔍 [AUTH-STATUS] VERCEL_TOKEN exists:', !!process.env.VERCEL_TOKEN)
    console.log('🔍 [AUTH-STATUS] SETUP_COMPLETE exists:', !!process.env.SETUP_COMPLETE)
    const isConfigured = !!process.env.MASTER_PASSWORD

    if (!isConfigured) {
      console.log('🔍 [AUTH-STATUS] Not configured, returning early')
      return NextResponse.json({
        isConfigured: false,
        debug_master_password_exists: !!process.env.MASTER_PASSWORD,
        debug_vercel_token_exists: !!process.env.VERCEL_TOKEN,
        isSetup: false,
        isAuthenticated: false,
        company: null
      })
    }

    console.log('🔍 [AUTH-STATUS] Calling getUserAuthStatus...')
    const status = await getUserAuthStatus()
    console.log('🔍 [AUTH-STATUS] getUserAuthStatus result:', JSON.stringify(status, null, 2))

    const response = {
      isConfigured: true,
      isSetup: status.isSetup,
      isAuthenticated: status.isAuthenticated,
      company: status.company,
      user: status.user
    }

    console.log('🔍 [AUTH-STATUS] Final response:', JSON.stringify(response, null, 2))
    return NextResponse.json(response)
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json(
      { error: 'Failed to check auth status' },
      { status: 500 }
    )
  }
}
