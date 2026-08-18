import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { MembersSidebar } from "@/components/MembersSidebar";
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

  const { data: channels } = await supabase
    .from("channels")
    .select("id, name, type, created_at")
    .eq("bando_id", id)
    .order("created_at");

  const textChannels = (channels ?? []).filter((c) => c.type === "text");
  const voiceChannels = (channels ?? []).filter((c) => c.type === "voice");

  const { data: members } = await supabase
    .from("bando_members")
    .select("profiles(id, username, avatar_seed)")
    .eq("bando_id", id);

  const memberList = (members ?? [])
    .map(
      (m) =>
        m.profiles as unknown as Pick<Profile, "id" | "username" | "avatar_seed">,
    )
    .filter(Boolean)
    .map((profile) => ({
      id: profile.id,
      username: profile.username,
      avatarSeed: profile.avatar_seed,
      isOwner: profile.id === bando.owner_id,
    }));

  const voiceChannelNames = Object.fromEntries(
    voiceChannels.map((c) => [c.id, c.name]),
  );

  const isOwner = bando.owner_id === user.id;

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChannelSidebar
        bandoId={id}
        bandoName={bando.name}
        inviteUrl={inviteUrl}
        isOwner={isOwner}
        textChannels={textChannels}
        voiceChannels={voiceChannels}
      />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      <MembersSidebar
        bandoId={id}
        members={memberList}
        voiceChannelNames={voiceChannelNames}
      />
    </div>
  );
}
