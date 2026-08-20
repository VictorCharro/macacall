"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Hash, Pin, Send, Search, Users, CornerDownRight, X } from "lucide-react";
import {
  sendMessage,
  togglePinMessage,
  editMessage,
  deleteMessage,
  type SendMessageState,
} from "@/app/actions/messages";
import { toggleReaction } from "@/app/actions/reactions";
import { markChannelRead } from "@/app/actions/reads";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { MessageReactions } from "@/components/MessageReactions";
import { MentionPopup } from "@/components/MentionPopup";
import { MentionText } from "@/components/MentionText";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";
import { PinnedMessagesModal } from "@/components/PinnedMessagesModal";
import { useMembersPanel } from "@/components/MembersPanelProvider";
import { useBandoRoles } from "@/components/BandoRolesProvider";
import { summarizeReactions, type RawReaction } from "@/lib/reactions";
import type { RawAttachment } from "@/lib/attachments";
import {
  findMentionTrigger,
  applyMention,
  mentionsUser,
  renderMentionSegments,
  type Mentionable,
} from "@/lib/mentions";

type Member = { username: string; avatarSeed: string };
type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  reply_to_id: string | null;
  pinned: boolean;
  edited_at?: string | null;
};

const initialState: SendMessageState = {};

export function ChatChannel({
  channelId,
  channelName,
  channelTopic,
  initialMessages,
  initialReactions,
  initialAttachments,
  members,
  canManageMessages,
  currentUserId,
  showMembersToggle = true,
}: {
  channelId: string;
  channelName: string;
  channelTopic: string | null;
  initialMessages: ChatMessage[];
  initialReactions: RawReaction[];
  initialAttachments: RawAttachment[];
  members: Record<string, Member>;
  canManageMessages: boolean;
  currentUserId: string;
  /** Hidden when the chat is docked under a voice call, which has no members panel. */
  showMembersToggle?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<RawReaction[]>(initialReactions);
  const [attachments, setAttachments] = useState<RawAttachment[]>(initialAttachments);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pinnedModalOpen, setPinnedModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputKey, setInputKey] = useState(0);
  const { membersOpen, toggleMembers } = useMembersPanel();
  const { roleColorByUserId, mentionableRoles, canMentionEveryone, myRoleIds } =
    useBandoRoles();

  const userMentionables: Mentionable[] = useMemo(
    () =>
      Object.entries(members).map(([userId, m]) => ({
        key: userId,
        label: m.username,
        kind: "user" as const,
      })),
    [members],
  );
  const everyoneMentionable: Mentionable = {
    key: "everyone",
    label: "everyone",
    kind: "everyone",
  };
  // Rendering recognizes every possible mention regardless of who's allowed
  // to type one -- only the *composer's suggestion list* is gated.
  const allMentionables: Mentionable[] = useMemo(
    () => [...userMentionables, ...mentionableRoles, everyoneMentionable],
    [userMentionables, mentionableRoles],
  );
  const mentionables: Mentionable[] = useMemo(
    () =>
      canMentionEveryone
        ? [...userMentionables, ...mentionableRoles, everyoneMentionable]
        : userMentionables,
    [userMentionables, mentionableRoles, canMentionEveryone],
  );

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

  function handleComposerInput(e: React.FormEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const cursor = input.selectionStart ?? input.value.length;
    const trigger = findMentionTrigger(input.value, cursor);
    setMentionTrigger(trigger);
    setMentionActiveIndex(0);
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mentionTrigger || mentionSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionActiveIndex((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionActiveIndex(
        (i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectMention(mentionSuggestions[mentionActiveIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionTrigger(null);
    }
  }

  const sendMessageWithChannel = sendMessage.bind(null, channelId);
  const [state, formAction] = useActionState(
    sendMessageWithChannel,
    initialState,
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    setInputKey((k) => k + 1);
    setReplyingTo(null);
    setMentionTrigger(null);
    if (state.message) {
      const sent = state.message;
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent],
      );
      if (sent.attachments?.length) {
        const withMessageId = sent.attachments.map((a) => ({ ...a, message_id: sent.id }));
        setAttachments((prev) => [
          ...prev,
          ...withMessageId.filter((a) => !prev.some((p) => p.id === a.id)),
        ]);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`messages:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            const row = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row],
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            const row = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)),
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            const row = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
          },
        )
        // Attachments finish uploading slightly after the message row itself
        // (they're a separate insert in the same server action), so other
        // clients see the text first and the files pop in a beat later.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_attachments" },
          (payload) => {
            const row = payload.new as RawAttachment;
            setAttachments((prev) =>
              prev.some((a) => a.id === row.id) ? prev : [...prev, row],
            );
          },
        )
        // message_reactions carries no channel_id, so this listens broadly and
        // drops anything for a message we aren't showing. RLS already limits
        // the stream to bandos this user belongs to.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_reactions" },
          (payload) => {
            const row = payload.new as RawReaction;
            setReactions((prev) =>
              prev.some(
                (r) =>
                  r.message_id === row.message_id &&
                  r.user_id === row.user_id &&
                  r.emoji === row.emoji,
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
                  !(
                    r.message_id === row.message_id &&
                    r.user_id === row.user_id &&
                    r.emoji === row.emoji
                  ),
              ),
            );
          },
        )
        .subscribe();

      cleanup = () => supabase.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear the unread badge for this channel whenever new messages land while
  // it's the one on screen.
  useEffect(() => {
    markChannelRead(channelId);
  }, [channelId, messages.length]);

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

  const visibleMessages = search.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : messages;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <header className="z-10 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border-soft bg-card px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Hash className="h-5 w-5 shrink-0 text-muted" />
          <span className="truncate text-sm font-bold text-accent">
            {channelName}
          </span>
          {channelTopic && (
            <>
              <div className="mx-1 hidden h-4 w-px shrink-0 bg-border md:block" />
              <span className="hidden max-w-md truncate text-xs text-muted md:inline">
                {channelTopic}
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-28 rounded bg-card-3 px-2 py-1 pl-6 text-xs text-foreground placeholder-muted outline-none transition focus:ring-1 focus:ring-primary md:w-36"
            />
            <Search className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-muted" />
          </div>

          <button
            type="button"
            onClick={() => setPinnedModalOpen(true)}
            title="Mensagens fixadas"
            aria-label="Mensagens fixadas"
            className="rounded p-1.5 text-muted transition hover:bg-card-2 hover:text-accent"
          >
            <Pin className="h-4 w-4" />
          </button>

          {showMembersToggle && (
            <button
              type="button"
              onClick={toggleMembers}
              title={membersOpen ? "Ocultar membros" : "Mostrar membros"}
              aria-label={membersOpen ? "Ocultar membros" : "Mostrar membros"}
              className={`rounded p-1.5 transition ${
                membersOpen
                  ? "bg-secondary/10 text-secondary"
                  : "text-muted hover:bg-card-2 hover:text-accent"
              }`}
            >
              <Users className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="scroll-hover min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-4">
        <div className="flex flex-col items-start gap-2 border-b border-border-soft py-6">
          <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10">
            <Hash className="h-8 w-8 text-secondary" />
          </div>
          <h2 className="text-2xl font-black text-accent">
            Bem-vindo a {channelName}!
          </h2>
          <p className="max-w-lg text-xs text-muted">
            Esse é o começo do canal{" "}
            <strong className="text-foreground">#{channelName}</strong>. Manda
            mensagem, ideia, emoji de macaco e chama a galera pra conversa!
          </p>
        </div>

        {visibleMessages.length === 0 && (
          <p className="pt-4 text-center text-sm text-muted">
            {search.trim()
              ? "Nenhuma mensagem encontrada 🐒"
              : "Ninguém falou nada por aqui ainda 🍌"}
          </p>
        )}

        {visibleMessages.map((message) => {
          const member = members[message.user_id];
          const repliedTo = message.reply_to_id
            ? messages.find((m) => m.id === message.reply_to_id)
            : null;
          const repliedMember = repliedTo ? members[repliedTo.user_id] : null;
          const mentionsMe =
            message.user_id !== currentUserId &&
            mentionsUser(
              renderMentionSegments(message.content, allMentionables),
              currentUserId,
              myRoleIds,
            );

          return (
            <div
              key={message.id}
              className={`group relative -mx-4 flex gap-3.5 rounded px-4 py-1.5 transition-colors hover:bg-card-2/80 ${
                mentionsMe ? "bg-primary/10 hover:bg-primary/15" : ""
              }`}
            >
              {message.reply_to_id && (
                <div className="absolute -top-3 left-12 flex items-center gap-1.5 text-[11px] text-muted">
                  <CornerDownRight className="h-3.5 w-3.5 text-muted" />
                  {repliedTo ? (
                    <>
                      <span className="font-semibold text-secondary">
                        @{repliedMember?.username ?? "Macaco"}
                      </span>
                      <span className="max-w-xs truncate italic text-muted">
                        {repliedTo.content}
                      </span>
                    </>
                  ) : (
                    <span className="italic">mensagem original apagada</span>
                  )}
                </div>
              )}

              <img
                src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member?.avatarSeed ?? message.user_id)}`}
                alt=""
                className="mt-0.5 h-10 w-10 shrink-0 rounded-full border border-border bg-card-3"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="cursor-pointer text-sm font-bold text-foreground hover:underline"
                    style={{ color: roleColorByUserId[message.user_id] ?? undefined }}
                  >
                    {member?.username ?? "Macaco"}
                  </span>
                  <span className="text-[10px] text-muted">
                    {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {message.pinned && (
                    <Pin
                      className="h-3.5 w-3.5 shrink-0 text-muted"
                      aria-label="Mensagem fixada"
                    />
                  )}
                  {message.edited_at && (
                    <span className="text-[10px] text-muted">(editado)</span>
                  )}
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
                  <div className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    <MentionText
                      content={message.content}
                      mentionables={allMentionables}
                      isMentioningMe={(m) =>
                        m.kind === "everyone" ||
                        (m.kind === "user" && m.key === currentUserId) ||
                        (m.kind === "role" && myRoleIds.includes(m.key))
                      }
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
                pinned={message.pinned}
                canPin={canManageMessages}
                canEdit={message.user_id === currentUserId}
                canDelete={message.user_id === currentUserId || canManageMessages}
                onTogglePin={() => togglePinMessage(message.id, !message.pinned)}
                onEdit={() => setEditingId(message.id)}
                onDelete={() => {
                  setMessages((prev) => prev.filter((m) => m.id !== message.id));
                  deleteMessage(message.id);
                }}
                onReply={() => {
                  setReplyingTo(message);
                  inputRef.current?.focus();
                }}
                onReact={(emoji) => toggleReaction(message.id, emoji)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {replyingTo && (
        <div className="flex items-center justify-between border-t border-border bg-card-3 px-4 py-1.5 text-xs text-muted">
          <div className="flex items-center gap-2 truncate">
            <CornerDownRight className="h-3.5 w-3.5 text-primary" />
            <span>
              Respondendo a{" "}
              <strong className="text-foreground">
                {members[replyingTo.user_id]?.username ?? "Macaco"}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancelar resposta"
            className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form action={formAction} key={inputKey} className="relative shrink-0 p-4 pt-1">
        <input type="hidden" name="replyToId" value={replyingTo?.id ?? ""} />
        <MentionPopup
          suggestions={mentionSuggestions}
          activeIndex={mentionActiveIndex}
          onSelect={selectMention}
        />
        <div className="relative flex items-center gap-3 rounded-xl border border-border bg-card-2 px-4 py-2.5 shadow-inner transition focus-within:border-primary/80">
          <AttachmentPicker />
          <input
            ref={inputRef}
            type="text"
            name="content"
            maxLength={2000}
            placeholder={`Conversar em #${channelName}`}
            autoComplete="off"
            onInput={handleComposerInput}
            onKeyDown={handleComposerKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted outline-none"
          />
          <EmojiPickerButton targetRef={inputRef} />
          <button
            type="submit"
            aria-label="Enviar mensagem"
            className="shrink-0 rounded-lg bg-primary p-1.5 font-bold text-primary-foreground shadow-md transition active:scale-95 hover:brightness-110"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {state.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
      </form>

      {pinnedModalOpen && (
        <PinnedMessagesModal
          channelId={channelId}
          members={members}
          canUnpin={canManageMessages}
          onClose={() => setPinnedModalOpen(false)}
        />
      )}
    </div>
  );
}

/** Inline edit box that replaces a message's body -- Discord-style: Enter to
 * save, Esc or Cancel to back out, autosized to the existing content. */
export function EditMessageForm({
  initialContent,
  onSave,
  onCancel,
}: {
  initialContent: string;
  onSave: (content: string) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  async function save() {
    if (pending) return;
    setPending(true);
    const res = await onSave(value);
    setPending(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="mt-0.5">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        maxLength={2000}
        rows={1}
        className="w-full resize-none rounded-lg border border-primary/60 bg-card-2 px-2.5 py-1.5 text-sm text-foreground outline-none"
      />
      <p className="mt-1 text-[11px] text-muted">
        Enter pra salvar · Esc pra cancelar
        {error && <span className="ml-2 text-danger">{error}</span>}
      </p>
    </div>
  );
}
