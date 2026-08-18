import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FriendsHome } from "@/components/FriendsHome";
import type { PresenceStatus, Profile } from "@/lib/types";

type ProfileRow = Pick<Profile, "id" | "username" | "avatar_seed" | "status">;

export default async function BandosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_seed, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const { data: friendships } = await supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, username, avatar_seed, status), addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_seed, status)",
    )
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friends: { friendshipId: string; profile: ProfileRow }[] = [];
  const incoming: { friendshipId: string; profile: ProfileRow }[] = [];
  const outgoing: { friendshipId: string; profile: ProfileRow }[] = [];

  for (const f of friendships ?? []) {
    const iAmRequester = f.requester_id === user.id;
    const other = (
      iAmRequester ? f.addressee : f.requester
    ) as unknown as ProfileRow;
    if (!other) continue;

    if (f.status === "accepted") {
      friends.push({ friendshipId: f.id, profile: other });
    } else if (iAmRequester) {
      outgoing.push({ friendshipId: f.id, profile: other });
    } else {
      incoming.push({ friendshipId: f.id, profile: other });
    }
  }

  const { data: dms } = await supabase
    .from("dm_conversations")
    .select(
      "id, user_a_id, user_b_id, user_a:profiles!dm_conversations_user_a_id_fkey(id, username, avatar_seed, status), user_b:profiles!dm_conversations_user_b_id_fkey(id, username, avatar_seed, status)",
    )
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

  const dmEntries = (dms ?? [])
    .map((d) => {
      const other = (
        d.user_a_id === user.id ? d.user_b : d.user_a
      ) as unknown as ProfileRow;
      if (!other) return null;
      return { conversationId: d.id, profile: other };
    })
    .filter((d): d is { conversationId: string; profile: ProfileRow } =>
      Boolean(d),
    );

  return (
    <FriendsHome
      currentUserId={user.id}
      selfUsername={profile.username}
      selfAvatarSeed={profile.avatar_seed}
      friends={friends.map((f) => ({
        friendshipId: f.friendshipId,
        id: f.profile.id,
        username: f.profile.username,
        avatarSeed: f.profile.avatar_seed,
        status: f.profile.status as PresenceStatus,
      }))}
      incoming={incoming.map((f) => ({
        friendshipId: f.friendshipId,
        id: f.profile.id,
        username: f.profile.username,
        avatarSeed: f.profile.avatar_seed,
        status: f.profile.status as PresenceStatus,
      }))}
      outgoing={outgoing.map((f) => ({
        friendshipId: f.friendshipId,
        id: f.profile.id,
        username: f.profile.username,
        avatarSeed: f.profile.avatar_seed,
        status: f.profile.status as PresenceStatus,
      }))}
      dms={dmEntries.map((d) => ({
        conversationId: d.conversationId,
        id: d.profile.id,
        username: d.profile.username,
        avatarSeed: d.profile.avatar_seed,
        status: d.profile.status as PresenceStatus,
      }))}
    />
  );
}
