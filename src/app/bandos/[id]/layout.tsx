import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { MembersSidebar } from "@/components/MembersSidebar";
import { BandoParticipantsProvider } from "@/components/BandoParticipants";
import { MembersPanelProvider } from "@/components/MembersPanelProvider";
import type { Profile } from "@/lib/types";

export default async function BandoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bando } = await supabase
    .from("bandos")
    .select("id, name, owner_id, invite_code")
    .eq("id", id)
    .maybeSingle();

  if (!bando) notFound();

  const headerList = await headers();
  const host = headerList.get("host") ?? "macacall.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const inviteUrl = `${protocol}://${host}/join/${bando.invite_code}`;

  const [{ data: channels }, { data: unreadRows }, { data: members }] =
    await Promise.all([
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
    .map((profile) => ({
      id: profile.id,
      username: profile.username,
      avatarSeed: profile.avatar_seed,
      isOwner: profile.id === bando.owner_id,
      statusMessage: profile.status_message,
      bio: profile.bio,
      bannerColor: profile.banner_color,
    }));

  const voiceChannelNames = Object.fromEntries(
    voiceChannels.map((c) => [c.id, c.name]),
  );

  const isOwner = bando.owner_id === user.id;
  const self = memberList.find((m) => m.id === user.id);

  return (
    <BandoParticipantsProvider bandoId={id}>
      <MembersPanelProvider>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ChannelSidebar
            bandoId={id}
            bandoName={bando.name}
            inviteUrl={inviteUrl}
            isOwner={isOwner}
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            selfUsername={self?.username ?? "Macaco"}
            selfAvatarSeed={self?.avatarSeed ?? user.id}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>

          <MembersSidebar
            bandoId={id}
            members={memberList}
            voiceChannelNames={voiceChannelNames}
            currentUserId={user.id}
          />
        </div>
      </MembersPanelProvider>
    </BandoParticipantsProvider>
  );
}
