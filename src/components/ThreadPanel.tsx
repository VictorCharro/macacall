"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { X, Hash, Send } from "lucide-react";
import {
  sendThreadMessage,
  getThreadMessages,
  type SendThreadMessageState,
} from "@/app/actions/threads";
import { editMessage, deleteMessage, togglePinMessage } from "@/app/actions/messages";
import { toggleReaction } from "@/app/actions/reactions";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";
import { EditMessageForm } from "@/components/ChatChannel";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { MessageReactions } from "@/components/MessageReactions";
import { MentionText } from "@/components/MentionText";
import { MentionPopup } from "@/components/MentionPopup";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";
import { useBandoRoles } from "@/components/BandoRolesProvider";
import { UserProfileModal } from "@/components/UserProfileModal";
import { summarizeReactions, type RawReaction } from "@/lib/reactions";
import type { RawAttachment } from "@/lib/attachments";
import { findMentionTrigger, applyMention, type Mentionable } from "@/lib/mentions";

type Member = { username: string; avatarSeed: string };
type ThreadMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  edited_at?: string | null;
};

const initialState: SendThreadMessageState = {};

export function ThreadPanel({
  threadId,
  threadName,
  channelId,
  parentMessage,
  members,
  currentUserId,
  canManageMessages,
  onClose,
}: {
  threadId: string;
  threadName: string;
  channelId: string;
  parentMessage: { content: string; user_id: string } | null;
  members: Record<string, Member>;
  currentUserId: string;
  canManageMessages: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [reactions, setReactions] = useState<RawReaction[]>([]);
  const [attachments, setAttachments] = useState<RawAttachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { roleColorByUserId, mentionableRoles, canMentionEveryone } = useBandoRoles();

  const userMentionables: Mentionable[] = useMemo(
    () =>
      Object.entries(members).map(([userId, m]) => ({
        key: userId,
        label: m.username,
        kind: "user" as const,
      })),
    [members],
  );
  const mentionables: Mentionable[] = canMentionEveryone
    ? [
        ...userMentionables,
        ...mentionableRoles,
        { key: "everyone", label: "everyone", kind: "everyone" as const },
      ]
    : userMentionables;

  const [mentionTrigger, setMentionTrigger] = useState<{
    start: number;
    query: string;
  } | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const mentionSuggestions = mentionTrigger
    ? mentionables
        .filter((m) => m.label.toLowerCase().startsWith(mentionTrigger.query.toLowerCase()))
        .slice(0, 8)
    : [];

  function selectMention(m: Mentionable) {
    const input = inputRef.current;
    if (!input || !mentionTrigger) return;
    const cursor = input.selectionStart ?? input.value.length;
    const { value, cursor: nextCursor } = applyMention(
      input.value,
      mentionTrigger.start,
      cursor,
      m.label,
    );
    input.value = value;
    input.setSelectionRange(nextCursor, nextCursor);
    input.focus();
    setMentionTrigger(null);
  }

  useEffect(() => {
    let cancelled = false;
    getThreadMessages(threadId).then((data) => {
      if (cancelled) return;
      setMessages(data.messages);
      setReactions(data.reactions);
      setAttachments(data.attachments);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`thread:${threadId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
          (payload) => {
            const row = payload.new as ThreadMessage;
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
          (payload) => {
            const row = payload.new as ThreadMessage;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
          (payload) => {
            const row = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_reactions" },
          (payload) => {
            const row = payload.new as RawReaction;
            setReactions((prev) =>
              prev.some(
                (r) => r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji,
              )
                ? prev
                : [...prev, row],
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "message_reactions" },
          (payload) => {
            const row = payload.old as RawReaction;
            setReactions((prev) =>
              prev.filter(
                (r) =>
                  !(r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji),
              ),
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_attachments" },
          (payload) => {
            const row = payload.new as RawAttachment;
            setAttachments((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
          },
        )
        .subscribe();

      cleanup = () => supabase.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendWithThread = sendThreadMessage.bind(null, threadId, channelId);
  const [state, formAction] = useActionState(sendWithThread, initialState);

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    setInputKey((k) => k + 1);
    setMentionTrigger(null);
    if (state.message) {
      const sent = state.message;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      if (sent.attachments?.length) {
        const withId = sent.attachments.map((a) => ({ ...a, message_id: sent.id }));
        setAttachments((prev) => [...prev, ...withId.filter((a) => !prev.some((p) => p.id === a.id))]);
      }
    }
  }

  const reactionsByMessage = useMemo(
    () => summarizeReactions(reactions, currentUserId),
    [reactions, currentUserId],
  );
  const attachmentsByMessage = useMemo(() => {
    const map = new Map<string, RawAttachment[]>();
    for (const a of attachments) {
      const list = map.get(a.message_id) ?? [];
      list.push(a);
      map.set(a.message_id, list);
    }
    return map;
  }, [attachments]);

  const parentAuthor = parentMessage ? members[parentMessage.user_id] : null;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border-soft bg-card">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border-soft px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Hash className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate text-sm font-bold text-accent">{threadName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar thread"
          className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="scroll-hover min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3">
        {parentMessage && (
          <div className="rounded-lg border border-border-soft bg-card-2 p-2.5 text-xs">
            <span className="font-bold text-foreground">
              {parentAuthor?.username ?? "Macaco"}
            </span>
            <p className="mt-0.5 text-muted">{parentMessage.content}</p>
          </div>
        )}

        {!loaded && <p className="text-center text-xs text-muted">Carregando...</p>}
        {loaded && messages.length === 0 && (
          <p className="text-center text-xs text-muted">Nenhuma resposta ainda.</p>
        )}

        {messages.map((message) => {
          const member = members[message.user_id];
          return (
            <div key={message.id} className="group relative flex gap-2.5 rounded px-1 py-1">
              <img
                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member?.avatarSeed ?? message.user_id)}`}
                alt=""
                onClick={() => setViewingProfile(message.user_id)}
                className="mt-0.5 h-7 w-7 shrink-0 cursor-pointer rounded-full border border-border bg-card-3"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    onClick={() => setViewingProfile(message.user_id)}
                    className="cursor-pointer text-xs font-bold text-foreground hover:underline"
                    style={{ color: roleColorByUserId[message.user_id] ?? undefined }}
                  >
                    {member?.username ?? "Macaco"}
                  </span>
                  <span className="text-[9px] text-muted">
                    {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {message.edited_at && <span className="text-[9px] text-muted">(editado)</span>}
                </div>

                {editingId === message.id ? (
                  <EditMessageForm
                    initialContent={message.content}
                    onCancel={() => setEditingId(null)}
                    onSave={async (content) => {
                      const res = await editMessage(message.id, content);
                      if (!res.error) setEditingId(null);
                      return res;
                    }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                    <MentionText
                      content={message.content}
                      mentionables={mentionables}
                      isMentioningMe={(m) => m.kind === "everyone" || m.key === currentUserId}
                    />
                  </div>
                )}

                <AttachmentGallery attachments={attachmentsByMessage.get(message.id) ?? []} />
                <MessageReactions
                  reactions={reactionsByMessage.get(message.id) ?? []}
                  onToggle={(emoji) => toggleReaction(message.id, emoji)}
                />
              </div>

              <MessageActionsMenu
                content={message.content}
                pinned={false}
                canPin={false}
                canEdit={message.user_id === currentUserId}
                canDelete={message.user_id === currentUserId || canManageMessages}
                onTogglePin={() => togglePinMessage(message.id, false)}
                onEdit={() => setEditingId(message.id)}
                onDelete={() => {
                  setMessages((prev) => prev.filter((m) => m.id !== message.id));
                  deleteMessage(message.id);
                }}
                onReact={(emoji) => toggleReaction(message.id, emoji)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form action={formAction} key={inputKey} className="relative shrink-0 p-3 pt-1">
        <MentionPopup
          suggestions={mentionSuggestions}
          activeIndex={mentionActiveIndex}
          onSelect={selectMention}
        />
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card-2 px-3 py-2 shadow-inner transition focus-within:border-primary/80">
          <AttachmentPicker />
          <input
            ref={inputRef}
            type="text"
            name="content"
            maxLength={2000}
            placeholder="Responder na thread"
            autoComplete="off"
            onInput={(e) => {
              const input = e.currentTarget;
              const cursor = input.selectionStart ?? input.value.length;
              setMentionTrigger(findMentionTrigger(input.value, cursor));
              setMentionActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (!mentionTrigger || mentionSuggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionActiveIndex((i) => (i + 1) % mentionSuggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionActiveIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                selectMention(mentionSuggestions[mentionActiveIndex]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setMentionTrigger(null);
              }
            }}
            className="flex-1 bg-transparent text-xs text-foreground placeholder-muted outline-none"
          />
          <EmojiPickerButton targetRef={inputRef} />
          <button
            type="submit"
            aria-label="Enviar"
            className="shrink-0 rounded-lg bg-primary p-1 font-bold text-primary-foreground transition active:scale-95 hover:brightness-110"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {state.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
      </form>

      {viewingProfile && (
        <UserProfileModal userId={viewingProfile} onClose={() => setViewingProfile(null)} />
      )}
    </aside>
  );
}
