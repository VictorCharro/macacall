import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { bandoId } = await request.json();

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("bando_id", bandoId)
    .eq("type", "voice")
    .limit(1)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json(
      { error: "canal de voz não encontrado ou você não é membro deste bando" },
      { status: 404 },
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "LiveKit ainda não foi configurado" },
      { status: 500 },
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: profile?.username ?? "Macaco anônimo",
  });

  token.addGrant({
    room: channel.id,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl,
  });
}
