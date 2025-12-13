import { createSupabaseClient } from "@/lib/supabase";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/supabase/users";

export async function GET() {
  try {
    const supabase = createSupabaseClient();

    // Get authenticated user from Kinde session and ensure they exist in Supabase
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create user in Supabase
    const userId = await getOrCreateUser(user);
    if (!userId) {
      return NextResponse.json(
        { error: "Failed to create or retrieve user" },
        { status: 500 }
      );
    }

    // Fetch conversations for the user, ordered by most recent first
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    console.error("Conversations API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
