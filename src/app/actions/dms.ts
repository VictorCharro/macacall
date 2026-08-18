"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";

export type SendDmState = BandoActionState & {
  message?: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
  };
};

export async function startDm(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("dm_conversations")
    .select("id, user_a_id, user_b_id")
    .or(
      `and(user_a_id.eq.${user.id},user_b_id.eq.${friendId}),and(user_a_id.eq.${friendId},user_b_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (existing) {
    redirect(`/bandos/dm/${existing.id}`);
  }

  const { data: created, error } = await supabase
    .from("dm_conversations")
    .insert({ user_a_id: user.id, user_b_id: friendId })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/bandos?error=${encodeURIComponent(error?.message ?? "Erro ao iniciar conversa")}`,
    );
  }

  redirect(`/bandos/dm/${created.id}`);
}

export async function sendDmMessage(
  conversationId: string,
  _prevState: SendDmState,
  formData: FormData,
): Promise<SendDmState> {
  const content = String(formData.get("content")).trim();

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

  const { data, error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, user_id: user.id, content })
    .select("id, content, created_at, user_id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Erro ao enviar mensagem" };
  }

  return { message: data };
}
