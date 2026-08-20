import type { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

type ProfileRow = Pick<Profile, "id" | "username" | "avatar_seed">;

export async function buildDmSidebarEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dmRows: { conversation_id: string }[],
) {
  if (dmRows.length === 0) return [];

  const [{ data: allParticipants }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("dm_participants")
      .select("conversation_id, profiles(id, username, avatar_seed)")
      .in(
        "conversation_id",
        dmRows.map((r) => r.conversation_id),
      ),
    supabase.rpc("unread_dm_counts", { p_user_id: userId }),
  ]);

  const unreadByConversation = new Map<string, number>(
    (unreadRows ?? []).map(
      (r: { conversation_id: string; unread: number }) => [r.conversation_id, Number(r.unread)],
    ),
  );

  const byConversation = new Map<string, ProfileRow[]>();
  for (const row of allParticipants ?? []) {
    const p = row.profiles as unknown as ProfileRow;
    if (!p) continue;
    const list = byConversation.get(row.conversation_id) ?? [];
    if (p.id !== userId) list.push(p);
    byConversation.set(row.conversation_id, list);
  }

  return dmRows
    .map((r) => {
      const others = byConversation.get(r.conversation_id) ?? [];
      const first = others[0];
      if (!first) return null;
      return {
        conversationId: r.conversation_id,
        id: first.id,
        username:
          others.length > 1
            ? others.map((o) => o.username).join(", ")
            : first.username,
        avatarSeed: first.avatar_seed,
        // A group DM has no single "other person", so anything that acts on
        // one specific user (the right-click menu) stays off for those.
        isGroup: others.length > 1,
        unread: unreadByConversation.get(r.conversation_id) ?? 0,
      };
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
}
