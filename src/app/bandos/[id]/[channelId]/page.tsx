import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
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
    .select("id, content, created_at, user_id, reply_to_id, pinned, edited_at")
    .eq("channel_id", channelId)
    .order("created_at")
    .limit(100);

  const ids = (messages ?? []).map((m) => m.id);
  const [{ data: reactions }, { data: attachments }] = ids.length
    ? await Promise.all([
        supabase
          .from("message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", ids),
        supabase
          .from("message_attachments")
          .select("id, message_id, url, name, mime_type")
          .in("message_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  return {
    messages: messages ?? [],
    reactions: reactions ?? [],
    attachments: attachments ?? [],
  };
}

/** MANAGE_MESSAGES bit -- keep in sync with src/lib/permissions.ts. */
const MANAGE_MESSAGES = 8;

async function canManageMessagesIn(supabase: SupabaseClient, userId: string, channelId: string) {
  const { data } = await supabase.rpc("has_channel_permission", {
    p_user_id: userId,
    p_channel_id: channelId,
    p_bit: MANAGE_MESSAGES,
  });
  return Boolean(data);
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string; channelId: string }>;
}) {
  const { id, channelId } = await params;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: channel },
    { data: bando },
    { data: bandoMembers },
  ] = await Promise.all([
    getCachedUser(),
    supabase
      .from("channels")
      .select("id, name, type, topic, bando_id")
      .eq("id", channelId)
      .eq("bando_id", id)
      .maybeSingle(),
    supabase.from("bandos").select("owner_id").eq("id", id).maybeSingle(),
    supabase
      .from("bando_members")
      .select("profiles(id, username, avatar_seed)")
      .eq("bando_id", id),
  ]);

  if (!user) redirect("/login");
  if (!channel) notFound();

  const isOwner = bando?.owner_id === user.id;

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
      const [{ messages, reactions, attachments }, canManageMessages] = await Promise.all([
        loadThread(supabase, primaryTextChannel.id),
        isOwner
          ? Promise.resolve(true)
          : canManageMessagesIn(supabase, user.id, primaryTextChannel.id),
      ]);

      textChannel = {
        id: primaryTextChannel.id,
        name: primaryTextChannel.name,
        topic: primaryTextChannel.topic,
        initialMessages: messages,
        initialReactions: reactions,
        initialAttachments: attachments,
        members,
        canManageMessages,
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

  const [{ messages, reactions, attachments }, canManageMessages] = await Promise.all([
    loadThread(supabase, channelId),
    isOwner ? Promise.resolve(true) : canManageMessagesIn(supabase, user.id, channelId),
  ]);

  return (
    <ChatChannel
      key={channel.id}
      channelId={channel.id}
      channelName={channel.name}
      channelTopic={channel.topic}
      initialMessages={messages}
      initialReactions={reactions}
      initialAttachments={attachments}
      members={members}
      canManageMessages={canManageMessages}
      currentUserId={user.id}
    />
  );
}
