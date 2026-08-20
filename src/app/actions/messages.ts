"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";
import { collectAttachmentFiles, uploadAttachments } from "@/lib/attachments";
import { sendPushToUser } from "@/lib/push";
import { renderMentionSegments, type Mentionable } from "@/lib/mentions";

export type SendMessageState = BandoActionState & {
  message?: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    reply_to_id: string | null;
    pinned: boolean;
    attachments?: { id: string; url: string; name: string; mime_type: string | null }[];
  };
};

export async function sendMessage(
  channelId: string,
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const content = String(formData.get("content")).trim();
  const replyToId = formData.get("replyToId");

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
    .from("messages")
    .insert({
      channel_id: channelId,
      user_id: user.id,
      content,
      reply_to_id:
        typeof replyToId === "string" && replyToId ? replyToId : null,
    })
    .select("id, content, created_at, user_id, reply_to_id, pinned")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Erro ao enviar mensagem" };
  }

  if (content) {
    await notifyMentionedMembers(supabase, channelId, user.id, content);
  }

  if (files.length === 0) {
    return { message: data };
  }

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

export async function editMessage(
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

  // RLS also enforces user_id = auth.uid(), so this only ever touches the
  // caller's own message -- the .eq is just a cheaper first filter.
  const { error } = await supabase
    .from("messages")
    .update({ content: trimmed, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteMessage(
  messageId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.from("messages").delete().eq("id", messageId);

  if (error) return { error: error.message };
  return {};
}

/** Pushes whoever a channel message actually @mentions -- unlike DMs, most
 * channel messages aren't addressed to anyone in particular, so pushing on
 * every message would just be noise. Resolves @role and @everyone down to
 * the individual members they cover. */
async function notifyMentionedMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelId: string,
  senderId: string,
  content: string,
) {
  if (!content.includes("@")) return;

  const { data: channel } = await supabase
    .from("channels")
    .select("bando_id")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return;

  const [{ data: members }, { data: roles }, { data: memberRoles }, { data: senderProfile }] =
    await Promise.all([
      supabase
        .from("bando_members")
        .select("user_id, profiles(username)")
        .eq("bando_id", channel.bando_id),
      supabase.from("roles").select("id, name").eq("bando_id", channel.bando_id),
      supabase.from("member_roles").select("user_id, role_id").eq("bando_id", channel.bando_id),
      supabase.from("profiles").select("username").eq("id", senderId).maybeSingle(),
    ]);

  const memberList = (members ?? [])
    .map((m) => ({
      userId: m.user_id,
      username: (m.profiles as unknown as { username: string } | null)?.username,
    }))
    .filter((m): m is { userId: string; username: string } => !!m.username);

  const mentionables: Mentionable[] = [
    ...memberList.map((m) => ({ key: m.userId, label: m.username, kind: "user" as const })),
    ...(roles ?? []).map((r) => ({ key: r.id, label: r.name, kind: "role" as const })),
    { key: "everyone", label: "everyone", kind: "everyone" as const },
  ];

  const segments = renderMentionSegments(content, mentionables);
  const targetIds = new Set<string>();

  for (const seg of segments) {
    if (!("mention" in seg)) continue;
    if (seg.mention.kind === "user") {
      targetIds.add(seg.mention.key);
    } else if (seg.mention.kind === "everyone") {
      memberList.forEach((m) => targetIds.add(m.userId));
    } else {
      (memberRoles ?? [])
        .filter((mr) => mr.role_id === seg.mention.key)
        .forEach((mr) => targetIds.add(mr.user_id));
    }
  }

  targetIds.delete(senderId);
  if (targetIds.size === 0) return;

  const senderName = senderProfile?.username ?? "Macaco";

  await Promise.all(
    [...targetIds].map((userId) =>
      sendPushToUser(userId, {
        title: `${senderName} mencionou você`,
        body: content,
        url: `/bandos/${channel.bando_id}/${channelId}`,
        tag: `channel-${channelId}`,
      }),
    ),
  );
}
