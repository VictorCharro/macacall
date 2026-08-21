import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ParticipantInfo = {
  identity: string;
  name: string;
  channelId: string;
  avatarSeed: string;
  avatarUrl: string | null;
  sharingScreen: boolean;
  micMuted: boolean;
  deafened: boolean;
  forceMuted: boolean;
  forceDeafened: boolean;
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
    const perChannel = await Promise.all(
      voiceChannels.map(async (channel) => {
        try {
          const participants = await roomService.listParticipants(channel.id);
          return { channel, participants };
        } catch {
          return { channel, participants: [] };
        }
      }),
    );

    const allIdentities = [
      ...new Set(
        perChannel.flatMap(({ participants }) => participants.map((p) => p.identity)),
      ),
    ];

    const { data: profiles } =
      allIdentities.length > 0
        ? await supabase
            .from("profiles")
            .select("id, avatar_seed, avatar_url")
            .in("id", allIdentities)
        : { data: [] };

    const avatarById = new Map(
      (profiles ?? []).map((p) => [p.id, { seed: p.avatar_seed, url: p.avatar_url }]),
    );

    const results = perChannel.map(({ channel, participants }) =>
      participants.map((p): ParticipantInfo => {
        const micTrack = p.tracks.find((t) => t.source === TrackSource.MICROPHONE);
        const avatar = avatarById.get(p.identity);
        return {
          identity: p.identity,
          name: p.name || "Macaco anônimo",
          channelId: channel.id,
          avatarSeed: avatar?.seed ?? p.identity,
          avatarUrl: avatar?.url ?? null,
          sharingScreen: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE),
          micMuted: micTrack ? micTrack.muted : true,
          deafened: p.attributes?.deafened === "true",
          forceMuted: p.attributes?.forceMuted === "true",
          forceDeafened: p.attributes?.forceDeafened === "true",
        };
      }),
    );

    return NextResponse.json({ participants: results.flat() });
  } catch {
    return NextResponse.json({ participants: [] });
  }
}
