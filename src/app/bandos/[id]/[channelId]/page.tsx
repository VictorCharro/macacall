import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatChannel } from "@/components/ChatChannel";
import { VoiceChannelView } from "@/components/VoiceChannelView";
import type { Profile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Loads a text channel's recent messages plus every reaction on them. */
async function loadThread(
  supabase: SupabaseClient,
  channelId: string,
) {
  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, created_at, user_id, reply_to_id, pinned")
    .eq("channel_id", channelId)
    .order("created_at")
    .limit(100);

  const ids = (messages ?? []).map((m) => m.id);
  const { data: reactions } = ids.length
    ? await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", ids)
    : { data: [] };

  return { messages: messages ?? [], reactions: reactions ?? [] };
}

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
    .select("id, name, type, topic, bando_id")
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

  if (channel.type === "voice") {
    // Discord docks a voice channel's video call above its own text chat --
    // our voice channels don't carry a message thread of their own, so we
    // reuse the bando's oldest ("primary") text channel underneath, same as
    // every voice channel in a real server implicitly shares #geral.
    const { data: primaryTextChannel } = await supabase
      .from("channels")
      .select("id, name, topic")
      .eq("bando_id", id)
      .eq("type", "text")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    let textChannel = null;
    if (primaryTextChannel) {
      const { messages, reactions } = await loadThread(
        supabase,
        primaryTextChannel.id,
      );

      textChannel = {
        id: primaryTextChannel.id,
        name: primaryTextChannel.name,
        topic: primaryTextChannel.topic,
        initialMessages: messages,
        initialReactions: reactions,
        members,
        canPin,
      };
    }

    return (
      <VoiceChannelView
        bandoId={id}
        channelId={channel.id}
        channelName={channel.name}
        currentUserId={user.id}
        textChannel={textChannel}
      />
    );
  }

  const { messages, reactions } = await loadThread(supabase, channelId);

  return (
    <ChatChannel
      key={channel.id}
      channelId={channel.id}
      channelName={channel.name}
      channelTopic={channel.topic}
      initialMessages={messages}
      initialReactions={reactions}
      members={members}
      canPin={canPin}
      currentUserId={user.id}
    />
  );
}
