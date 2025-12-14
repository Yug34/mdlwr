import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kindeAuth: string }> }
): Promise<NextResponse> {
  const { kindeAuth } = await params;
  // handleAuth handles the authentication flow based on the endpoint
  // Type assertion needed because Kinde's typing doesn't perfectly match Next.js route handler types
  return (await handleAuth(request, kindeAuth)) as unknown as NextResponse;
}
