"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";
import { collectAttachmentFiles, uploadAttachments } from "@/lib/attachments";

export type SendDmState = BandoActionState & {
  message?: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    attachments?: { id: string; url: string; name: string; mime_type: string | null }[];
  };
};

async function getOrCreateDmConversationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  friendId: string,
): Promise<{ id: string } | { error: string }> {
  const { data: mine } = await supabase
    .from("dm_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  const { data: theirs } = await supabase
    .from("dm_participants")
    .select("conversation_id")
    .eq("user_id", friendId);

  const theirIds = new Set((theirs ?? []).map((r) => r.conversation_id));
  const sharedIds = (mine ?? [])
    .map((r) => r.conversation_id)
    .filter((id) => theirIds.has(id));

  if (sharedIds.length > 0) {
    const { data: existing } = await supabase
      .from("dm_conversations")
      .select("id")
      .in("id", sharedIds)
      .eq("is_group", false)
      .maybeSingle();

    if (existing) return { id: existing.id };
  }

  const { data: created, error } = await supabase
    .from("dm_conversations")
    .insert({ created_by: userId, is_group: false })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "Erro ao iniciar conversa" };
  }

  const { error: participantsError } = await supabase
    .from("dm_participants")
    .insert([
      { conversation_id: created.id, user_id: userId },
      { conversation_id: created.id, user_id: friendId },
    ]);

  if (participantsError) {
    return { error: participantsError.message };
  }

  return { id: created.id };
}

export async function startDm(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = await getOrCreateDmConversationId(supabase, user.id, friendId);

  if ("error" in result) {
    redirect(`/bandos?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/bandos/dm/${result.id}`);
}

export async function startDmCall(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const result = await getOrCreateDmConversationId(supabase, user.id, friendId);

  if ("error" in result) {
    redirect(`/bandos?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/bandos/dm/${result.id}?call=1`);
}

export async function inviteFriendToBando(
  friendId: string,
  bandoId: string,
): Promise<BandoActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bando } = await supabase
    .from("bandos")
    .select("name, invite_code")
    .eq("id", bandoId)
    .maybeSingle();

  if (!bando) return { error: "Bando não encontrado" };

  const result = await getOrCreateDmConversationId(supabase, user.id, friendId);
  if ("error" in result) return { error: result.error };

  const headerList = await headers();
  const host = headerList.get("host") ?? "macacall.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const inviteUrl = `${protocol}://${host}/join/${bando.invite_code}`;

  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: result.id,
    user_id: user.id,
    content: `🐒 Te chamei pro bando "${bando.name}"! ${inviteUrl}`,
  });

  if (error) return { error: error.message };

  return {};
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

  const { error: participantsError } = await supabase
    .from("dm_participants")
    .insert([
      { conversation_id: created.id, user_id: user.id },
      ...memberIds.map((id) => ({ conversation_id: created.id, user_id: id })),
    ]);

  if (participantsError) {
    redirect(
      `/bandos?error=${encodeURIComponent(participantsError.message)}`,
    );
  }

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

  const files = collectAttachmentFiles(formData);
  if ("error" in files) return { error: files.error };

  if (!content && files.length === 0) {
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

  if (files.length === 0) {
    return { message: data };
  }

  const uploaded = await uploadAttachments(supabase, files, "d", conversationId, data.id);
  if ("error" in uploaded) {
    return { message: data, error: `Mensagem enviada, mas anexo falhou: ${uploaded.error}` };
  }

  const { data: attachmentRows, error: attachError } = await supabase
    .from("dm_message_attachments")
    .insert(
      uploaded.map((a) => ({
        message_id: data.id,
        url: a.url,
        name: a.name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
      })),
    )
    .select("id, url, name, mime_type");

  if (attachError) {
    return { message: data, error: `Mensagem enviada, mas anexo falhou: ${attachError.message}` };
  }

  return { message: { ...data, attachments: attachmentRows ?? [] } };
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

export async function editDmMessage(
  messageId: string,
  content: string,
): Promise<{ error?: string }> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "Mensagem não pode ficar vazia" };
  if (trimmed.length > 2000) {
    return { error: "Mensagem muito longa (máximo 2000 caracteres)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("dm_messages")
    .update({ content: trimmed, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteDmMessage(
  messageId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("dm_messages")
    .delete()
    .eq("id", messageId);

  if (error) return { error: error.message };
  return {};
}
