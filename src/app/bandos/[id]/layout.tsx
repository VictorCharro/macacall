import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { MembersSidebar } from "@/components/MembersSidebar";
import { BandoParticipantsProvider } from "@/components/BandoParticipants";
import { MembersPanelProvider } from "@/components/MembersPanelProvider";
import { BandoRolesProvider } from "@/components/BandoRolesProvider";
import { hasPermission } from "@/lib/permissions";
import type { Mentionable } from "@/lib/mentions";
import type { Profile, Role } from "@/lib/types";

export default async function BandoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: bando },
  ] = await Promise.all([
    getCachedUser(),
    supabase
      .from("bandos")
      .select("id, name, owner_id, invite_code")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!user) redirect("/login");
  if (!bando) notFound();

  const headerList = await headers();
  const host = headerList.get("host") ?? "macacall.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const inviteUrl = `${protocol}://${host}/join/${bando.invite_code}`;

  const isOwner = bando.owner_id === user.id;

  const [
    { data: channels },
    { data: unreadRows },
    { data: members },
    { data: roles },
    { data: memberRoles },
    { data: myPermissionsRaw },
  ] = await Promise.all([
    supabase
      .from("channels")
      .select("id, name, type, category, topic, position, created_at")
      .eq("bando_id", id)
      .order("position")
      .order("created_at"),
    supabase.rpc("unread_counts", { p_bando_id: id }),
    supabase
      .from("bando_members")
      .select(
        "profiles(id, username, avatar_seed, status_message, bio, banner_color)",
      )
      .eq("bando_id", id),
    supabase
      .from("roles")
      .select("*")
      .eq("bando_id", id)
      .order("position", { ascending: false }),
    supabase.from("member_roles").select("user_id, role_id").eq("bando_id", id),
    isOwner
      ? Promise.resolve({ data: null })
      : supabase.rpc("bando_permissions", {
          p_user_id: user.id,
          p_bando_id: id,
        }),
  ]);

  const unreadByChannel = new Map<string, number>(
    (unreadRows ?? []).map((r: { channel_id: string; unread: number }) => [
      r.channel_id,
      Number(r.unread),
    ]),
  );

  const withUnread = (c: {
    id: string;
    name: string;
    category: string | null;
    topic: string | null;
  }) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    topic: c.topic,
    unread: unreadByChannel.get(c.id) ?? 0,
  });

  const textChannels = (channels ?? [])
    .filter((c) => c.type === "text")
    .map(withUnread);
  const voiceChannels = (channels ?? [])
    .filter((c) => c.type === "voice")
    .map(withUnread);

  const allRoles = (roles ?? []) as Role[];

  const roleIdsByUser = new Map<string, string[]>();
  for (const mr of memberRoles ?? []) {
    const list = roleIdsByUser.get(mr.user_id) ?? [];
    list.push(mr.role_id);
    roleIdsByUser.set(mr.user_id, list);
  }

  function highestAssignedRole(userId: string): Role | null {
    const ids = roleIdsByUser.get(userId) ?? [];
    const assigned = allRoles.filter((r) => !r.is_default && ids.includes(r.id));
    return assigned[0] ?? null; // allRoles is already sorted position desc
  }

  const memberList = (members ?? [])
    .map(
      (m) =>
        m.profiles as unknown as Pick<
          Profile,
          | "id"
          | "username"
          | "avatar_seed"
          | "status_message"
          | "bio"
          | "banner_color"
        >,
    )
    .filter(Boolean)
    .map((profile) => {
      const topRole = highestAssignedRole(profile.id);
      return {
        id: profile.id,
        username: profile.username,
        avatarSeed: profile.avatar_seed,
        isOwner: profile.id === bando.owner_id,
        statusMessage: profile.status_message,
        bio: profile.bio,
        bannerColor: profile.banner_color,
        roleColor: topRole?.color ?? null,
        roleIds: roleIdsByUser.get(profile.id) ?? [],
        hoistedRoleName: topRole?.hoist ? topRole.name : null,
        highestRolePosition: topRole?.position ?? 0,
      };
    });

  const voiceChannelNames = Object.fromEntries(
    voiceChannels.map((c) => [c.id, c.name]),
  );

  const roleColorByUserId: Record<string, string | null> = Object.fromEntries(
    memberList.map((m) => [m.id, m.roleColor]),
  );

  const self = memberList.find((m) => m.id === user.id);
  const myPermissions = isOwner ? 0 : Number(myPermissionsRaw ?? 0);
  const myHighestPosition = self?.highestRolePosition ?? 0;

  const mentionableRoles: Mentionable[] = allRoles
    .filter((r) => !r.is_default)
    .map((r) => ({ key: r.id, label: r.name, kind: "role" as const }));
  const canMentionEveryone = isOwner || hasPermission(myPermissions, "MENTION_EVERYONE");
  const myRoleIds = roleIdsByUser.get(user.id) ?? [];

  return (
    <BandoParticipantsProvider bandoId={id}>
      <BandoRolesProvider
        roleColorByUserId={roleColorByUserId}
        mentionableRoles={mentionableRoles}
        canMentionEveryone={canMentionEveryone}
        myRoleIds={myRoleIds}
      >
      <MembersPanelProvider>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ChannelSidebar
            bandoId={id}
            bandoName={bando.name}
            inviteUrl={inviteUrl}
            isOwner={isOwner}
            myPermissions={myPermissions}
            roles={allRoles}
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            selfUsername={self?.username ?? "Macaco"}
            selfAvatarSeed={self?.avatarSeed ?? user.id}
            selfUserId={user.id}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>

          <MembersSidebar
            bandoId={id}
            members={memberList}
            roles={allRoles}
            voiceChannelNames={voiceChannelNames}
            currentUserId={user.id}
            isOwner={isOwner}
            myPermissions={myPermissions}
            myHighestPosition={myHighestPosition}
          />
        </div>
      </MembersPanelProvider>
      </BandoRolesProvider>
    </BandoParticipantsProvider>
  );
}

