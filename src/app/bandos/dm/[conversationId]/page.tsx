import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FriendsSidebar } from "@/components/FriendsSidebar";
import { DmChat } from "@/components/DmChat";
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
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_seed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const { data: conversation } = await supabase
    .from("dm_conversations")
    .select(
      "id, user_a_id, user_b_id, user_a:profiles!dm_conversations_user_a_id_fkey(id, username, avatar_seed), user_b:profiles!dm_conversations_user_b_id_fkey(id, username, avatar_seed)",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (
    !conversation ||
    (conversation.user_a_id !== user.id && conversation.user_b_id !== user.id)
  ) {
    notFound();
  }

  const otherProfile = (
    conversation.user_a_id === user.id
      ? conversation.user_b
      : conversation.user_a
  ) as unknown as ProfileRow;

  const { data: messages } = await supabase
    .from("dm_messages")
    .select("id, content, created_at, user_id")
    .eq("conversation_id", conversationId)
    .order("created_at")
    .limit(100);

  const { data: dms } = await supabase
    .from("dm_conversations")
    .select(
      "id, user_a_id, user_b_id, user_a:profiles!dm_conversations_user_a_id_fkey(id, username, avatar_seed), user_b:profiles!dm_conversations_user_b_id_fkey(id, username, avatar_seed)",
    )
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

  const dmEntries = (dms ?? [])
    .map((d) => {
      const other = (
        d.user_a_id === user.id ? d.user_b : d.user_a
      ) as unknown as ProfileRow;
      if (!other) return null;
      return {
        conversationId: d.id,
        id: other.id,
        username: other.username,
        avatarSeed: other.avatar_seed,
      };
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <div className="flex flex-1 overflow-hidden">
      <FriendsSidebar
        selfUsername={profile.username}
        selfAvatarSeed={profile.avatar_seed}
        dms={dmEntries}
      />
      <DmChat
        key={conversationId}
        conversationId={conversationId}
        otherUsername={otherProfile.username}
        otherAvatarSeed={otherProfile.avatar_seed}
        currentUserId={user.id}
        currentAvatarSeed={profile.avatar_seed}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
