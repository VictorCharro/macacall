"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Stamps "I've seen everything in this channel up to now". Unread counts are
 * derived by comparing this against each message's created_at, so there is no
 * counter to keep in sync -- opening a channel just moves the watermark.
 */
export async function markChannelRead(channelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fired on navigation, so a signed-out user is a no-op rather than a redirect.
  if (!user) return {};

  const { error } = await supabase.from("channel_reads").upsert(
    {
      user_id: user.id,
      channel_id: channelId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel_id" },
  );

  return error ? { error: error.message } : {};
}

/** Same idea as markChannelRead, but for a DM/group conversation. */
export async function markDmRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  const { error } = await supabase.from("dm_reads").upsert(
    {
      user_id: user.id,
      conversation_id: conversationId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,conversation_id" },
  );

  return error ? { error: error.message } : {};
}
