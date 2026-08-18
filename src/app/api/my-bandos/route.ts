import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: memberships } = await supabase
    .from("bando_members")
    .select("bandos(id, name)")
    .eq("user_id", user.id);

  const bandos = (memberships ?? [])
    .map((m) => m.bandos as unknown as { id: string; name: string })
    .filter(Boolean);

  return NextResponse.json({ bandos });
}
