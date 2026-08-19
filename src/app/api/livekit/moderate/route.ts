import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/lib/permissions";

function getRoomService() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !livekitUrl) return null;
  const httpUrl = livekitUrl.replace(/^ws/, "http");
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, channelId, targetUserId } = body as {
    action: "mute" | "unmute" | "deafen" | "undeafen" | "move";
    channelId: string;
    targetUserId: string;
  };

  if (!action || !channelId || !targetUserId) {
    return NextResponse.json({ error: "parâmetros faltando" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const requiredBit =
    action === "move"
      ? PERMISSIONS.MOVE_MEMBERS
      : action === "deafen" || action === "undeafen"
        ? PERMISSIONS.DEAFEN_MEMBERS
        : PERMISSIONS.MUTE_MEMBERS;

  const { data: allowed } = await supabase.rpc("has_channel_permission", {
    p_user_id: user.id,
    p_channel_id: channelId,
    p_bit: requiredBit,
  });

  if (!allowed) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const roomService = getRoomService();
  if (!roomService) {
    return NextResponse.json(
      { error: "LiveKit ainda não foi configurado" },
      { status: 500 },
    );
  }

  try {
    if (action === "mute" || action === "unmute") {
      const shouldMute = action === "mute";

      // The published-track mute is best-effort: if the target hasn't
      // published a mic track yet (or the LiveKit call throws for any other
      // reason), that must NOT prevent the forceMuted attribute below from
      // being set — that attribute is what actually drives the moderation
      // UI and what the target's own client reacts to.
      try {
        const participants = await roomService.listParticipants(channelId);
        const target = participants.find((p) => p.identity === targetUserId);
        const micTrack = target?.tracks.find(
          (t) => t.source === TrackSource.MICROPHONE,
        );
        if (micTrack) {
          await roomService.mutePublishedTrack(
            channelId,
            targetUserId,
            micTrack.sid,
            shouldMute,
          );
        }
      } catch {
        // segue o baile: o atributo abaixo ainda é aplicado
      }

      await roomService.updateParticipant(channelId, targetUserId, {
        attributes: { forceMuted: shouldMute ? "true" : "false" },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "deafen" || action === "undeafen") {
      const shouldDeafen = action === "deafen";

      // Deliberately doesn't touch the mic/forceMuted at all — ensurdecer
      // only affects what the target can hear, not their own mic. Mute and
      // deafen are independent actions here (unlike a moment-ago attempt
      // that copied Discord's "server deafen also server mutes" behavior,
      // which turned out not to be wanted for this app).
      await roomService.updateParticipant(channelId, targetUserId, {
        attributes: { forceDeafened: shouldDeafen ? "true" : "false" },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "move") {
      const { destinationChannelId } = body as { destinationChannelId?: string };
      if (!destinationChannelId) {
        return NextResponse.json(
          { error: "destinationChannelId é obrigatório" },
          { status: 400 },
        );
      }

      const { data: destination } = await supabase
        .from("channels")
        .select("id, name")
        .eq("id", destinationChannelId)
        .eq("type", "voice")
        .maybeSingle();

      if (!destination) {
        return NextResponse.json(
          { error: "canal de destino não encontrado" },
          { status: 404 },
        );
      }

      // The target's own client (listening to its own attributes) picks this
      // up and switches rooms itself — LiveKit has no server-side "transfer a
      // participant between rooms" primitive, so this is a signal, not a move.
      await roomService.updateParticipant(channelId, targetUserId, {
        attributes: {
          movedToChannelId: destination.id,
          movedToChannelName: destination.name,
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro inesperado" },
      { status: 500 },
    );
  }
}
