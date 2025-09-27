import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Generate a secure nonce (must be at least 8 alphanumeric characters)
    const nonce = crypto.randomUUID().replace(/-/g, "");
    
    // Store the nonce in a secure cookie
    cookies().set("siwe", nonce, { 
      secure: true,
      httpOnly: true,
      sameSite: 'strict'
    });
    
    return NextResponse.json({ nonce });
  } catch (error) {
    console.error("Error generating nonce:", error);
    return NextResponse.json(
      { error: "Failed to generate nonce" }, 
      { status: 500 }
    );
  }
}
