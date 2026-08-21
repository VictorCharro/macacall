"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Video, Pin, UserPlus, Globe, Send } from "lucide-react";
import {
  sendDmMessage,
  toggleDmPinMessage,
  editDmMessage,
  deleteDmMessage,
  type SendDmState,
} from "@/app/actions/dms";
import { toggleDmReaction } from "@/app/actions/reactions";
import { markDmRead } from "@/app/actions/reads";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";
import { useCall } from "@/components/CallProvider";
import { CallInterface } from "@/components/VoiceChannelView";
import { EditMessageForm } from "@/components/ChatChannel";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { MessageReactions } from "@/components/MessageReactions";
import { MentionPopup } from "@/components/MentionPopup";
import { MentionText } from "@/components/MentionText";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { AttachmentGallery } from "@/components/AttachmentGallery";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";
import { DmPinnedMessagesModal } from "@/components/DmPinnedMessagesModal";
import { AddDmParticipantModal } from "@/components/AddDmParticipantModal";
import { DmProfilePanel } from "@/components/DmProfilePanel";
import { UserProfileModal } from "@/components/UserProfileModal";
import { summarizeReactions, type RawReaction } from "@/lib/reactions";
import type { RawAttachment } from "@/lib/attachments";
import {
  findMentionTrigger,
  applyMention,
  mentionsUser,
  renderMentionSegments,
  type Mentionable,
} from "@/lib/mentions";
import { avatarUrl } from "@/lib/avatar";

type DmMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  pinned: boolean;
  edited_at?: string | null;
};

type Participant = {
  id: string;
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
};
type Friend = {
  id: string;
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
};
type Member = { username: string; avatarSeed: string; avatarUrl: string | null };

const initialState: SendDmState = {};

export function DmChat({
  conversationId,
  isGroup,
  groupName,
  participants,
  currentUserId,
  currentAvatarSeed,
  currentAvatarUrl,
  initialMessages,
  initialReactions,
  initialAttachments,
  availableFriendsToAdd,
}: {
  conversationId: string;
  isGroup: boolean;
  groupName: string | null;
  participants: Participant[];
  currentUserId: string;
  currentAvatarSeed: string;
  currentAvatarUrl: string | null;
  initialMessages: DmMessage[];
  initialReactions: RawReaction[];
  initialAttachments: RawAttachment[];
  availableFriendsToAdd: Friend[];
}) {
  const [messages, setMessages] = useState<DmMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<RawReaction[]>(initialReactions);
  const [attachments, setAttachments] = useState<RawAttachment[]>(initialAttachments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputKey, setInputKey] = useState(0);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatHidden, setChatHidden] = useState(false);

  const { activeCall, connected, joinCall } = useCall();
  const isThisCall = activeCall?.roomId === conversationId;

  const displayName =
    groupName ?? (participants.map((p) => p.username).join(", ") || "Macaco");

  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("call") === "1") {
      joinCall(conversationId, displayName, `/bandos/dm/${conversationId}`);
      router.replace(`/bandos/dm/${conversationId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const members: Record<string, Member> = Object.fromEntries([
    ...participants.map((p) => [
      p.id,
      { username: p.username, avatarSeed: p.avatarSeed, avatarUrl: p.avatarUrl },
    ]),
    [
      currentUserId,
      { username: "Você", avatarSeed: currentAvatarSeed, avatarUrl: currentAvatarUrl },
    ],
  ]);

  // Only other participants -- mentioning yourself in a DM does nothing.
  const mentionables: Mentionable[] = useMemo(
    () => participants.map((p) => ({ key: p.id, label: p.username, kind: "user" as const })),
    [participants],
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
    setMentionTrigger(findMentionTrigger(input.value, cursor));
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

  const sendMessageWithConversation = sendDmMessage.bind(null, conversationId);
  const [state, formAction] = useActionState(
    sendMessageWithConversation,
    initialState,
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    setInputKey((k) => k + 1);
    setMentionTrigger(null);
    if (state.message) {
      const sent = state.message;
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id)
          ? prev
          : [...prev, { ...sent, pinned: false }],
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
        .channel(`dm_messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as DmMessage;
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
            table: "dm_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as DmMessage;
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
            table: "dm_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "dm_message_attachments" },
          (payload) => {
            const row = payload.new as RawAttachment;
            setAttachments((prev) =>
              prev.some((a) => a.id === row.id) ? prev : [...prev, row],
            );
          },
        )
        // dm_message_reactions has no conversation_id, so this listens broadly
        // and drops rows for messages we aren't showing. RLS already limits the
        // stream to conversations this user takes part in.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "dm_message_reactions" },
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
          { event: "DELETE", schema: "public", table: "dm_message_reactions" },
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
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    markDmRead(conversationId);
  }, [conversationId, messages.length]);

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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center gap-2 border-b border-border-soft bg-background px-4">
          <img
            src={avatarUrl(participants[0]?.avatarSeed ?? conversationId, participants[0]?.avatarUrl)}
            alt=""
            className="h-7 w-7 rounded-full bg-background object-cover"
          />
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold text-accent">
            {displayName}
          </h1>

          <div className="flex items-center gap-1">
            <HeaderIcon
              label="Chamada de voz"
              disabled={isThisCall}
              onClick={() => joinCall(conversationId, displayName, `/bandos/dm/${conversationId}`)}
            >
              <Phone className="h-4 w-4" />
            </HeaderIcon>
            <HeaderIcon
              label="Chamada de vídeo"
              disabled={isThisCall}
              onClick={() =>
                joinCall(conversationId, displayName, `/bandos/dm/${conversationId}`, {
                  camera: true,
                })
              }
            >
              <Video className="h-4 w-4" />
            </HeaderIcon>
            <HeaderIcon label="Mensagens fixadas" onClick={() => setPinnedOpen(true)}>
              <Pin className="h-4 w-4" />
            </HeaderIcon>
            <HeaderIcon label="Adicionar pessoas" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" />
            </HeaderIcon>
            <HeaderIcon
              label={profileOpen ? "Esconder perfil" : "Mostrar perfil"}
              active={profileOpen}
              onClick={() => setProfileOpen((v) => !v)}
            >
              <Globe className="h-4 w-4" />
            </HeaderIcon>
          </div>
        </header>

        {isThisCall && connected && (
          <CallInterface
            channelName={displayName}
            compact
            chatHidden={chatHidden}
            onToggleChatHidden={() => setChatHidden((v) => !v)}
          />
        )}
        {isThisCall && !connected && (
          <div className="flex items-center gap-3 border-b border-border bg-card/60 px-6 py-3">
            <span className="animate-bounce text-xl">🐒</span>
            <p className="text-sm text-muted">Conectando à call...</p>
          </div>
        )}

        {!chatHidden && (
        <>
        <div className="scroll-hover min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-6 py-4">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted">
                  Comece a conversa com {displayName} 🍌
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const member = members[message.user_id];
                    const mentionsMe =
                      message.user_id !== currentUserId &&
                      mentionsUser(
                        renderMentionSegments(message.content, mentionables),
                        currentUserId,
                        [],
                      );
                    return (
                      <li
                        key={message.id}
                        className={`group relative -mx-2 flex items-start gap-3 rounded-lg px-2 py-1 hover:bg-card-2/60 ${
                          mentionsMe ? "bg-primary/10 hover:bg-primary/15" : ""
                        }`}
                      >
                        <img
                          src={avatarUrl(member?.avatarSeed ?? message.user_id, member?.avatarUrl)}
                          alt=""
                          onClick={() => setViewingProfile(message.user_id)}
                          className="h-9 w-9 shrink-0 cursor-pointer rounded-full bg-background object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span
                              onClick={() => setViewingProfile(message.user_id)}
                              className="cursor-pointer font-semibold text-accent hover:underline"
                            >
                              {member?.username ?? "Macaco"}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(message.created_at).toLocaleTimeString(
                                "pt-BR",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                            {message.pinned && (
                              <Pin className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Mensagem fixada" />
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
                                const res = await editDmMessage(message.id, content);
                                if (!res.error) setEditingId(null);
                                return res;
                              }}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                              <MentionText
                                content={message.content}
                                mentionables={mentionables}
                                isMentioningMe={(m) => m.key === currentUserId}
                              />
                            </p>
                          )}

                          <AttachmentGallery
                            attachments={attachmentsByMessage.get(message.id) ?? []}
                          />

                          <MessageReactions
                            reactions={reactionsByMessage.get(message.id) ?? []}
                            onToggle={(emoji) =>
                              toggleDmReaction(message.id, emoji)
                            }
                          />
                        </div>

                        <MessageActionsMenu
                          content={message.content}
                          pinned={message.pinned}
                          canPin
                          canEdit={message.user_id === currentUserId}
                          canDelete={message.user_id === currentUserId}
                          onTogglePin={() =>
                            toggleDmPinMessage(message.id, !message.pinned)
                          }
                          onEdit={() => setEditingId(message.id)}
                          onDelete={() => {
                            setMessages((prev) => prev.filter((m) => m.id !== message.id));
                            deleteDmMessage(message.id);
                          }}
                          onReact={(emoji) =>
                            toggleDmReaction(message.id, emoji)
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <div ref={bottomRef} />
        </div>

        <form action={formAction} key={inputKey} className="relative p-4 pt-1">
          <MentionPopup
            suggestions={mentionSuggestions}
            activeIndex={mentionActiveIndex}
            onSelect={selectMention}
          />
          <div className="relative flex items-center gap-3 rounded-xl border border-border-soft bg-card-2 px-4 py-2.5 shadow-inner transition focus-within:border-primary/70">
            <AttachmentPicker />
            <input
              ref={inputRef}
              type="text"
              name="content"
              maxLength={2000}
              placeholder={`Conversar com ${displayName}`}
              autoComplete="off"
              onInput={handleComposerInput}
              onKeyDown={handleComposerKeyDown}
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted outline-none"
            />
            <EmojiPickerButton targetRef={inputRef} />
            <button
              type="submit"
              aria-label="Enviar mensagem"
              className="shrink-0 rounded-lg p-1 text-primary transition hover:brightness-110"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          {state.error && (
            <p className="mt-1 text-xs text-danger">{state.error}</p>
          )}
        </form>
        </>
        )}
      </div>

      {profileOpen && (
        <DmProfilePanel participants={participants} isGroup={isGroup} />
      )}

      {pinnedOpen && (
        <DmPinnedMessagesModal
          conversationId={conversationId}
          members={members}
          onClose={() => setPinnedOpen(false)}
        />
      )}

      {addOpen && (
        <AddDmParticipantModal
          conversationId={conversationId}
          availableFriends={availableFriendsToAdd}
          onClose={() => setAddOpen(false)}
        />
      )}

      {viewingProfile && (
        <UserProfileModal userId={viewingProfile} onClose={() => setViewingProfile(null)} />
      )}
    </div>
  );
}

function HeaderIcon({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-default disabled:opacity-40 ${
        active
          ? "bg-secondary/20 text-secondary"
          : "text-muted hover:bg-card-2 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
