import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type FriendActivity = {
  friendId: string;
  bandoName: string;
  channelName: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = new Set(
    (friendships ?? []).map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id,
    ),
  );

  if (friendIds.size === 0) {
    return NextResponse.json({ activity: [] });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ activity: [] });
  }

  const httpUrl = livekitUrl.replace(/^ws/, "http");
  const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

  try {
    const rooms = await roomService.listRooms();
    if (rooms.length === 0) return NextResponse.json({ activity: [] });

    const { data: channels } = await supabase
      .from("channels")
      .select("id, name, bandos(name)")
      .in(
        "id",
        rooms.map((r) => r.name),
      );

    const channelInfo = new Map(
      (channels ?? []).map((c) => [
        c.id,
        {
          channelName: c.name,
          bandoName: (c.bandos as unknown as { name: string } | null)?.name ?? "",
        },
      ]),
    );

    const results = await Promise.all(
      rooms.map(async (room) => {
        const info = channelInfo.get(room.name);
        if (!info) return [];
        try {
          const participants = await roomService.listParticipants(room.name);
          return participants
            .filter((p) => friendIds.has(p.identity))
            .map(
              (p): FriendActivity => ({
                friendId: p.identity,
                bandoName: info.bandoName,
                channelName: info.channelName,
              }),
            );
        } catch {
          return [];
        }
      }),
    );

    return NextResponse.json({ activity: results.flat() });
  } catch {
    return NextResponse.json({ activity: [] });
  }
}
