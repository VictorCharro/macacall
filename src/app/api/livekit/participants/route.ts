import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const bandoId = new URL(request.url).searchParams.get("bandoId");

  if (!bandoId) {
    return NextResponse.json({ error: "bandoId é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("bando_id", bandoId)
    .eq("type", "voice")
    .limit(1)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json({ participants: [] });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ participants: [] });
  }

  const httpUrl = livekitUrl.replace(/^ws/, "http");
  const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

  try {
    const participants = await roomService.listParticipants(channel.id);
    return NextResponse.json({
      participants: participants.map((p) => ({
        identity: p.identity,
        name: p.name || "Macaco anônimo",
      })),
    });
  } catch {
    return NextResponse.json({ participants: [] });
  }
}
