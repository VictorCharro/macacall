"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";

export async function sendMessage(
  channelId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const content = String(formData.get("content")).trim();
  const replyToId = formData.get("replyToId");

  if (!content) {
    return {};
  }

  if (content.length > 2000) {
    return { error: "Mensagem muito longa (máximo 2000 caracteres)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.from("messages").insert({
    channel_id: channelId,
    user_id: user.id,
    content,
    reply_to_id: typeof replyToId === "string" && replyToId ? replyToId : null,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function togglePinMessage(
  messageId: string,
  pinned: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("messages")
    .update({ pinned })
    .eq("id", messageId);

  if (error) {
    return { error: error.message };
  }

  return {};
}
