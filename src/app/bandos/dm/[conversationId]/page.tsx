import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { DmChat } from "@/components/DmChat";
import { buildDmSidebarEntries } from "@/lib/dm-helpers";
import type { Profile } from "@/lib/types";

type ProfileRow = Pick<Profile, "id" | "username" | "avatar_seed">;

export default async function DmPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await getCachedUser();

  if (!user) redirect("/login");

  // None of these depend on each other's result — only on user.id/
  // conversationId, both already known — so they run as one round trip
  // instead of six back-to-back ones.
  const [
    { data: profile },
    { data: conversation },
    { data: participantRows },
    { data: messages },
    { data: friendships },
    { data: dmRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, avatar_seed")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("dm_conversations")
      .select("id, name, is_group")
      .eq("id", conversationId)
      .maybeSingle(),
    supabase
      .from("dm_participants")
      .select("user_id, profiles(id, username, avatar_seed)")
      .eq("conversation_id", conversationId),
    supabase
      .from("dm_messages")
      .select("id, content, created_at, user_id, pinned, edited_at")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .limit(100),
    supabase
      .from("friendships")
      .select(
        "requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username, avatar_seed), addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_seed)",
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    supabase
      .from("dm_participants")
      .select("conversation_id, dm_conversations(id, name, is_group)")
      .eq("user_id", user.id),
  ]);

  if (!profile) redirect("/onboarding");
  if (!conversation) notFound();

  const allParticipants = (participantRows ?? [])
    .map((p) => p.profiles as unknown as ProfileRow)
    .filter(Boolean);

  const isMember = allParticipants.some((p) => p.id === user.id);
  if (!isMember) notFound();

  const otherParticipants = allParticipants
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: p.id, username: p.username, avatarSeed: p.avatar_seed }));

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: reactions } = messageIds.length
    ? await supabase
        .from("dm_message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds)
    : { data: [] };

  const participantIds = new Set(allParticipants.map((p) => p.id));
  const availableFriendsToAdd = (friendships ?? [])
    .map((f) =>
      (f.requester_id === user.id ? f.addressee : f.requester) as unknown as ProfileRow,
    )
    .filter((p) => p && !participantIds.has(p.id))
    .map((p) => ({ id: p.id, username: p.username, avatarSeed: p.avatar_seed }));

  const dmEntries = await buildDmSidebarEntries(supabase, user.id, dmRows ?? []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <FriendsSidebar
        selfUsername={profile.username}
        selfAvatarSeed={profile.avatar_seed}
        dms={dmEntries}
      />
      <DmChat
        key={conversationId}
        conversationId={conversationId}
        isGroup={conversation.is_group}
        groupName={conversation.name}
        participants={otherParticipants}
        currentUserId={user.id}
        currentAvatarSeed={profile.avatar_seed}
        initialMessages={messages ?? []}
        initialReactions={reactions ?? []}
        availableFriendsToAdd={availableFriendsToAdd}
      />
    </div>
  );
}

