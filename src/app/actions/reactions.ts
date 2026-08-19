"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Reactions are a toggle: the same user hitting the same emoji twice removes
 * it. The (message_id, user_id, emoji) primary key makes the "already there?"
 * check a plain delete-then-insert rather than needing a read first.
 */
async function toggle(
  table: "message_reactions" | "dm_message_reactions",
  messageId: string,
  emoji: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
