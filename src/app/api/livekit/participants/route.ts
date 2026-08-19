import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ParticipantInfo = {
  identity: string;
  name: string;
  channelId: string;
  sharingScreen: boolean;
  micMuted: boolean;
  deafened: boolean;
  forceMuted: boolean;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bandoId = url.searchParams.get("bandoId");
  const channelId = url.searchParams.get("channelId");

  if (!bandoId && !channelId) {
    return NextResponse.json(
      { error: "bandoId ou channelId é obrigatório" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  let voiceChannels: { id: string }[] = [];

  if (channelId) {
    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("id", channelId)
      .eq("type", "voice")
      .maybeSingle();
    if (channel) voiceChannels = [channel];
  } else if (bandoId) {
    const { data: channels } = await supabase
      .from("channels")
      .select("id")
      .eq("bando_id", bandoId)
      .eq("type", "voice");
    voiceChannels = channels ?? [];
  }

  if (voiceChannels.length === 0) {
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
    const results = await Promise.all(
      voiceChannels.map(async (channel) => {
        try {
          const participants = await roomService.listParticipants(channel.id);
          return participants.map((p): ParticipantInfo => {
            const micTrack = p.tracks.find(
              (t) => t.source === TrackSource.MICROPHONE,
            );
            return {
              identity: p.identity,
              name: p.name || "Macaco anônimo",
              channelId: channel.id,
              sharingScreen: p.tracks.some(
                (t) => t.source === TrackSource.SCREEN_SHARE,
              ),
              micMuted: micTrack ? micTrack.muted : true,
              deafened: p.attributes?.deafened === "true",
              forceMuted: p.attributes?.forceMuted === "true",
            };
          });
        } catch {
          return [];
        }
      }),
    );

    return NextResponse.json({ participants: results.flat() });
  } catch {
    return NextResponse.json({ participants: [] });
  }
}
