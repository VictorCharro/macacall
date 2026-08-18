import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatChannel } from "@/components/ChatChannel";
import { VoiceChannelView } from "@/components/VoiceChannelView";
import type { Profile } from "@/lib/types";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string; channelId: string }>;
}) {
  const { id, channelId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: channel } = await supabase
    .from("channels")
    .select("id, name, type, bando_id")
    .eq("id", channelId)
    .eq("bando_id", id)
    .maybeSingle();

  if (!channel) notFound();

  const { data: bando } = await supabase
    .from("bandos")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  const canPin = bando?.owner_id === user.id;

  if (channel.type === "voice") {
    return (
      <VoiceChannelView
        bandoId={id}
        channelId={channel.id}
        channelName={channel.name}
      />
    );
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, created_at, user_id, reply_to_id, pinned")
    .eq("channel_id", channelId)
    .order("created_at")
    .limit(100);

  const { data: bandoMembers } = await supabase
    .from("bando_members")
    .select("profiles(id, username, avatar_seed)")
    .eq("bando_id", id);

  const members = Object.fromEntries(
    (bandoMembers ?? [])
      .map(
        (m) =>
          m.profiles as unknown as Pick<
            Profile,
            "id" | "username" | "avatar_seed"
          >,
      )
      .filter(Boolean)
      .map((profile) => [
        profile.id,
        { username: profile.username, avatarSeed: profile.avatar_seed },
      ]),
  );

  return (
    <ChatChannel
      key={channel.id}
      channelId={channel.id}
      channelName={channel.name}
      initialMessages={messages ?? []}
      members={members}
      canPin={canPin}
    />
  );
}
