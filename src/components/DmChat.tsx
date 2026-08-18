"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  sendDmMessage,
  toggleDmPinMessage,
  type SendDmState,
} from "@/app/actions/dms";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";
import { useCall } from "@/components/CallProvider";
import { CallInterface } from "@/components/VoiceChannelView";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { DmPinnedMessagesModal } from "@/components/DmPinnedMessagesModal";
import { AddDmParticipantModal } from "@/components/AddDmParticipantModal";
import { DmProfilePanel } from "@/components/DmProfilePanel";

type DmMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  pinned: boolean;
};

type Participant = { id: string; username: string; avatarSeed: string };
type Friend = { id: string; username: string; avatarSeed: string };
type Member = { username: string; avatarSeed: string };

const initialState: SendDmState = {};

export function DmChat({
  conversationId,
  isGroup,
  groupName,
  participants,
  currentUserId,
  currentAvatarSeed,
  initialMessages,
  availableFriendsToAdd,
}: {
  conversationId: string;
  isGroup: boolean;
  groupName: string | null;
  participants: Participant[];
  currentUserId: string;
  currentAvatarSeed: string;
  initialMessages: DmMessage[];
  availableFriendsToAdd: Friend[];
}) {
  const [messages, setMessages] = useState<DmMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [inputKey, setInputKey] = useState(0);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
    ...participants.map((p) => [p.id, { username: p.username, avatarSeed: p.avatarSeed }]),
    [currentUserId, { username: "Você", avatarSeed: currentAvatarSeed }],
  ]);

  const sendMessageWithConversation = sendDmMessage.bind(null, conversationId);
  const [state, formAction] = useActionState(
    sendMessageWithConversation,
    initialState,
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    setInputKey((k) => k + 1);
    if (state.message) {
      const sent = state.message;
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id)
          ? prev
          : [...prev, { ...sent, pinned: false }],
      );
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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border bg-card px-6 py-3">
          <img
            src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(participants[0]?.avatarSeed ?? conversationId)}`}
            alt=""
            className="h-7 w-7 rounded-full bg-background"
          />
          <h1 className="min-w-0 flex-1 truncate font-semibold text-accent">
            {displayName}
          </h1>

          <div className="flex items-center gap-1">
            <HeaderIcon
              label="Chamada de voz"
              disabled={isThisCall}
              onClick={() => joinCall(conversationId, displayName, `/bandos/dm/${conversationId}`)}
            >
              📞
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
              🎥
            </HeaderIcon>
            <HeaderIcon label="Mensagens fixadas" onClick={() => setPinnedOpen(true)}>
              📌
            </HeaderIcon>
            <HeaderIcon label="Adicionar pessoas" onClick={() => setAddOpen(true)}>
              👤➕
            </HeaderIcon>
            <HeaderIcon
              label={profileOpen ? "Esconder perfil" : "Mostrar perfil"}
              active={profileOpen}
              onClick={() => setProfileOpen((v) => !v)}
            >
              🌐
            </HeaderIcon>
          </div>
        </header>

        {isThisCall && connected && (
          <CallInterface channelName={displayName} compact />
        )}
        {isThisCall && !connected && (
          <div className="flex items-center gap-3 border-b border-border bg-card/60 px-6 py-3">
            <span className="animate-bounce text-xl">🐒</span>
            <p className="text-sm text-muted">Conectando à call...</p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted">
                  Comece a conversa com {displayName} 🍌
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const member = members[message.user_id];
                    return (
                      <li
                        key={message.id}
                        className="group relative -mx-2 flex items-start gap-3 rounded-lg px-2 py-1 hover:bg-border/20"
                      >
                        <img
                          src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member?.avatarSeed ?? message.user_id)}`}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full bg-background"
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-accent">
                              {member?.username ?? "Macaco"}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(message.created_at).toLocaleTimeString(
                                "pt-BR",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                            {message.pinned && (
                              <span title="Mensagem fixada" className="text-xs text-muted">
                                📌
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                            {message.content}
                          </p>
                        </div>

                        <MessageActionsMenu
                          content={message.content}
                          pinned={message.pinned}
                          canPin
                          onTogglePin={() =>
                            toggleDmPinMessage(message.id, !message.pinned)
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <div ref={bottomRef} />
        </div>

        <form
          action={formAction}
          key={inputKey}
          className="border-t border-border p-4"
        >
          <input
            type="text"
            name="content"
            maxLength={2000}
            placeholder={`Conversar com ${displayName}`}
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground outline-none focus:border-primary"
          />
          {state.error && (
            <p className="mt-1 text-xs text-danger">{state.error}</p>
          )}
        </form>
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
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition disabled:cursor-default disabled:opacity-40 ${
        active
          ? "bg-secondary/20 text-secondary"
          : "text-muted hover:bg-border/40 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
