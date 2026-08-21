import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { roomId } = await request.json();

  if (!roomId) {
    return NextResponse.json({ error: "roomId é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  // Independent of each other -- a room is either a voice channel or a DM,
  // never both, so there's no reason to check one and only then the other.
  const [{ data: profile }, { data: channel }, { data: participant }] =
    await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      supabase
        .from("channels")
        .select("id")
        .eq("id", roomId)
        .eq("type", "voice")
        .maybeSingle(),
      supabase
        .from("dm_participants")
        .select("conversation_id")
        .eq("conversation_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const authorized = Boolean(channel) || Boolean(participant);

  if (!authorized) {
    return NextResponse.json(
      { error: "sala não encontrada ou você não tem acesso a ela" },
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
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl,
  });
}
