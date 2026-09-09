import { WebhookReceiver } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

// Requires a webhook configured on the LiveKit project pointing here
// (LiveKit dashboard -> Webhooks -> this route's URL) -- reuses the same
// LIVEKIT_API_KEY/SECRET already used everywhere else in this app, LiveKit
// signs webhook requests with the same key pair.
const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY ?? "",
  process.env.LIVEKIT_API_SECRET ?? "",
);

const RELEVANT_EVENTS = new Set([
  "participant_joined",
  "participant_left",
  "track_published",
  "track_unpublished",
]);

/**
 * Relays LiveKit room activity into a Supabase Realtime broadcast so
 * `BandoParticipantsProvider` can react near-instantly instead of only
 * finding out on its next poll tick. Room name === channel id (see
 * api/livekit/token) so no DB lookup is needed here -- just forward the
 * channel id, the client already knows which bando it belongs to.
 *
 * Best-effort: if the broadcast doesn't land (network hiccup, or the
 * project enforces Realtime Authorization and this anon-key send isn't
 * allowed -- untested against a real project in this environment), the
 * client's own poll still covers it, just not instantly. Never throw past
 * the signature check.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const authHeader = request.headers.get("Authorization") ?? undefined;

  let event;
  try {
    event = await receiver.receive(body, authHeader);
  } catch {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const channelId = event.room?.name;
  if (channelId && RELEVANT_EVENTS.has(event.event)) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = supabase.channel(`voice-activity:${channelId}`);
    try {
      await channel.httpSend("changed", {});
    } catch {
      // best-effort -- the poll fallback covers this
    } finally {
      await supabase.removeChannel(channel);
    }
  }

  return NextResponse.json({ ok: true });
}
