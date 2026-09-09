"use server";

import { requireUser } from "@/lib/authGuard";

/**
 * Reactions are a toggle: the same user hitting the same emoji twice removes
 * it. The (message_id, user_id, emoji) primary key makes the "already there?"
 * check a plain delete-then-insert rather than needing a read first.
 */
// Generous enough for any real emoji picker output, including compound/ZWJ
// sequences (flags, skin tones, families) -- just a ceiling against a
// client sending an arbitrarily large string as "emoji".
const EMOJI_MAX_LENGTH = 16;

async function toggle(
  table: "message_reactions" | "dm_message_reactions",
  messageId: string,
  emoji: string,
): Promise<{ error?: string }> {
  if (!emoji || emoji.length > EMOJI_MAX_LENGTH) {
    return { error: "Emoji inválido" };
  }

  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from(table)
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);

    return error ? { error: error.message } : {};
  }

  const { error } = await supabase
    .from(table)
    .insert({ message_id: messageId, user_id: user.id, emoji });

  return error ? { error: error.message } : {};
}

export async function toggleReaction(messageId: string, emoji: string) {
  return toggle("message_reactions", messageId, emoji);
}

export async function toggleDmReaction(messageId: string, emoji: string) {
  return toggle("dm_message_reactions", messageId, emoji);
}
