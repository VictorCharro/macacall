"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  const { data: myConversations } = await supabase
    .from("dm_participants")
    .select("conversation_id, dm_conversations!inner(id, is_group)")
    .eq("user_id", user.id)
    .eq("dm_conversations.is_group", false);

  for (const row of myConversations ?? []) {
    const { data: otherParticipant } = await supabase
      .from("dm_participants")
      .select("user_id")
      .eq("conversation_id", row.conversation_id)
      .eq("user_id", friendId)
      .maybeSingle();

    if (otherParticipant) {
      redirect(`/bandos/dm/${row.conversation_id}`);
    }
  }

  const { data: created, error } = await supabase
    .from("dm_conversations")
    .insert({ created_by: user.id, is_group: false })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/bandos?error=${encodeURIComponent(error?.message ?? "Erro ao iniciar conversa")}`,
    );
  }

  await supabase.from("dm_participants").insert([
    { conversation_id: created.id, user_id: user.id },
    { conversation_id: created.id, user_id: friendId },
  ]);

  redirect(`/bandos/dm/${created.id}`);
}

export async function createGroupDm(memberIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: created, error } = await supabase
    .from("dm_conversations")
    .insert({ created_by: user.id, is_group: true })
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/bandos?error=${encodeURIComponent(error?.message ?? "Erro ao criar grupo")}`,
    );
  }

  await supabase.from("dm_participants").insert([
    { conversation_id: created.id, user_id: user.id },
    ...memberIds.map((id) => ({ conversation_id: created.id, user_id: id })),
  ]);

  redirect(`/bandos/dm/${created.id}`);
}

export async function addDmParticipant(
  conversationId: string,
  friendId: string,
): Promise<BandoActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("dm_conversations")
    .update({ is_group: true })
    .eq("id", conversationId);

  const { error } = await supabase
    .from("dm_participants")
    .insert({ conversation_id: conversationId, user_id: friendId });

  if (error) return { error: error.message };

  revalidatePath(`/bandos/dm/${conversationId}`);
  return {};
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

export async function toggleDmPinMessage(
  messageId: string,
  pinned: boolean,
): Promise<BandoActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("dm_messages")
    .update({ pinned })
    .eq("id", messageId);

  if (error) return { error: error.message };
  return {};
}
