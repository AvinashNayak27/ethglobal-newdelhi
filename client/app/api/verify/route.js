import { NextRequest, NextResponse } from 'next/server'
import { verifyCloudProof } from '@worldcoin/minikit-js'

export async function POST(req) {
  try {
    const { payload, action, signal } = await req.json()
    
    // Get APP_ID from environment variables
    const app_id ="app_44907b0dd088c5add325015e7aa18180"
    
    if (!app_id) {
      return NextResponse.json({ 
        error: 'APP_ID not configured in environment variables',
        status: 500 
      })
    }

    // Verify the proof using World ID's cloud verification
    const verifyRes = await verifyCloudProof(payload, app_id, action, signal)

    if (verifyRes.success) {
      // This is where you should perform backend actions if the verification succeeds
      // Such as, setting a user as "verified" in a database
      console.log('Verification successful for action:', action)
      console.log('Nullifier hash:', payload.nullifier_hash)
      
      return NextResponse.json({ 
        verifyRes, 
        status: 200,
        message: 'Verification successful'
      })
    } else {
      // This is where you should handle errors from the World ID /verify endpoint.
      // Usually these errors are due to a user having already verified.
      console.error('Verification failed:', verifyRes)
      
      return NextResponse.json({ 
        verifyRes, 
        status: 400,
        message: 'Verification failed'
      })
    }
  } catch (error) {
    console.error('Error in verify API route:', error)
    
    return NextResponse.json({ 
      error: error.message,
      status: 500,
      message: 'Internal server error during verification'
    })
  }
}
