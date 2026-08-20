"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { collectAttachmentFiles, uploadAttachments } from "@/lib/attachments";
import type { BandoActionState } from "@/app/actions/bandos";

export type CreateThreadState = BandoActionState & {
  thread?: { id: string; name: string };
};

/** Starts a thread off an existing message. One thread per message -- the
 * unique constraint on parent_message_id means a second attempt just fails
 * with a duplicate-key error, which the caller treats as "already exists". */
export async function createThread(
  channelId: string,
  parentMessageId: string,
  name: string,
): Promise<CreateThreadState> {
  const trimmed = name.trim() || "Thread";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("threads")
    .insert({
      channel_id: channelId,
      parent_message_id: parentMessageId,
      name: trimmed.slice(0, 100),
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (error) return { error: error.message };
  return { thread: data };
}

/** Loads a thread's replies + reactions + attachments in one go, for the
 * panel to fetch on open (it has no server-rendered page of its own). */
export async function getThreadMessages(threadId: string) {
  const supabase = await createClient();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, created_at, user_id, edited_at")
    .eq("thread_id", threadId)
    .order("created_at")
    .limit(200);

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

export type SendThreadMessageState = BandoActionState & {
  message?: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    edited_at?: string | null;
    attachments?: { id: string; url: string; name: string; mime_type: string | null }[];
  };
};

export async function sendThreadMessage(
  threadId: string,
  channelId: string,
  _prevState: SendThreadMessageState,
  formData: FormData,
): Promise<SendThreadMessageState> {
  const content = String(formData.get("content")).trim();
  const files = collectAttachmentFiles(formData);
  if ("error" in files) return { error: files.error };

  if (!content && files.length === 0) return {};
  if (content.length > 2000) {
    return { error: "Mensagem muito longa (máximo 2000 caracteres)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("messages")
    .insert({ channel_id: channelId, thread_id: threadId, user_id: user.id, content })
    .select("id, content, created_at, user_id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Erro ao enviar mensagem" };
  }

  if (files.length === 0) return { message: data };

  const uploaded = await uploadAttachments(supabase, files, "c", channelId, data.id);
  if ("error" in uploaded) {
    return { message: data, error: `Mensagem enviada, mas anexo falhou: ${uploaded.error}` };
  }

  const { data: attachmentRows, error: attachError } = await supabase
    .from("message_attachments")
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
