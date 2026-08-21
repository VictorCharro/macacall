import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { FriendsHome } from "@/components/FriendsHome";
import { buildDmSidebarEntries } from "@/lib/dm-helpers";
import type { PresenceStatus, Profile } from "@/lib/types";

type ProfileRow = Pick<
  Profile,
  "id" | "username" | "avatar_seed" | "avatar_url" | "status"
>;

export default async function BandosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getCachedUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: friendships }, { data: dmRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, avatar_seed, avatar_url, status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select(
          "id, requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, username, avatar_seed, avatar_url, status), addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_seed, avatar_url, status)",
        )
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      supabase.from("dm_participants").select("conversation_id").eq("user_id", user.id),
    ]);

  if (!profile) redirect("/onboarding");

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

  const dmEntries = await buildDmSidebarEntries(supabase, user.id, dmRows ?? []);

  return (
    <FriendsHome
      currentUserId={user.id}
      selfUsername={profile.username}
      selfAvatarSeed={profile.avatar_seed}
      selfAvatarUrl={profile.avatar_url}
      friends={friends.map((f) => ({
        friendshipId: f.friendshipId,
        id: f.profile.id,
        username: f.profile.username,
        avatarSeed: f.profile.avatar_seed,
        avatarUrl: f.profile.avatar_url,
        status: f.profile.status as PresenceStatus,
      }))}
      incoming={incoming.map((f) => ({
        friendshipId: f.friendshipId,
        id: f.profile.id,
        username: f.profile.username,
        avatarSeed: f.profile.avatar_seed,
        avatarUrl: f.profile.avatar_url,
        status: f.profile.status as PresenceStatus,
      }))}
      outgoing={outgoing.map((f) => ({
        friendshipId: f.friendshipId,
        id: f.profile.id,
        username: f.profile.username,
        avatarSeed: f.profile.avatar_seed,
        avatarUrl: f.profile.avatar_url,
        status: f.profile.status as PresenceStatus,
      }))}
      dms={dmEntries}
    />
  );
}
