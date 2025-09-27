import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifySiweMessage } from "@worldcoin/minikit-js";

export async function POST(req) {
  try {
    const { payload, nonce } = await req.json();
    
    // Verify the nonce matches what we stored
    const storedNonce = cookies().get("siwe")?.value;
    if (!storedNonce || nonce !== storedNonce) {
      return NextResponse.json({
        status: "error",
        isValid: false,
        message: "Invalid nonce",
      }, { status: 400 });
    }
    
    // Verify the SIWE message
    const validMessage = await verifySiweMessage(payload, nonce);
    
    if (validMessage.isValid) {
      // Clear the nonce after successful verification
      cookies().delete("siwe");
      
      return NextResponse.json({
        status: "success",
        isValid: true,
        address: payload.address,
      });
    } else {
      return NextResponse.json({
        status: "error",
        isValid: false,
        message: "Invalid signature",
      }, { status: 400 });
    }
  } catch (error) {
    console.error("SIWE verification error:", error);
    return NextResponse.json({
      status: "error",
      isValid: false,
      message: error.message || "Verification failed",
    }, { status: 500 });
  }
}
