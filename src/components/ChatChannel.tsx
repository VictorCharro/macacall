"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendMessage, type SendMessageState } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";
import { MessageActionsMenu } from "@/components/MessageActionsMenu";
import { PinnedMessagesModal } from "@/components/PinnedMessagesModal";

type Member = { username: string; avatarSeed: string };
type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  reply_to_id: string | null;
  pinned: boolean;
};

const initialState: SendMessageState = {};

export function ChatChannel({
  channelId,
  channelName,
  initialMessages,
  members,
  canPin,
}: {
  channelId: string;
  channelName: string;
  initialMessages: ChatMessage[];
  members: Record<string, Member>;
  canPin: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pinnedModalOpen, setPinnedModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputKey, setInputKey] = useState(0);

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
    if (state.message) {
      const sent = state.message;
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent],
      );
    }
  }

  useEffect(() => {
    const supabase = createClient();
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-muted">#</span>
          <h1 className="font-semibold text-accent">{channelName}</h1>
        </div>
        <button
          type="button"
          onClick={() => setPinnedModalOpen(true)}
          title="Mensagens fixadas"
          aria-label="Mensagens fixadas"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-border/40 hover:text-accent"
        >
          📌
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">
            Ninguém falou nada por aqui ainda 🍌
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              const member = members[message.user_id];
              const repliedTo = message.reply_to_id
                ? messages.find((m) => m.id === message.reply_to_id)
                : null;
              const repliedMember = repliedTo
                ? members[repliedTo.user_id]
                : null;

              return (
                <li
                  key={message.id}
                  className="group relative flex items-start gap-3 rounded-lg px-2 py-1 -mx-2 hover:bg-border/20"
                >
                  <img
                    src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(member?.avatarSeed ?? message.user_id)}`}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full bg-background"
                  />
                  <div className="min-w-0 flex-1">
                    {message.reply_to_id && (
                      <p className="mb-0.5 flex items-center gap-1 truncate text-xs text-muted">
                        <span aria-hidden="true">↪</span>
                        {repliedTo ? (
                          <>
                            <span className="font-medium text-secondary">
                              {repliedMember?.username ?? "Macaco"}
                            </span>
                            <span className="truncate">
                              {repliedTo.content}
                            </span>
                          </>
                        ) : (
                          <span className="italic">
                            mensagem original não encontrada
                          </span>
                        )}
                      </p>
                    )}
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
                        <span
                          title="Mensagem fixada"
                          className="text-xs text-muted"
                          aria-label="Mensagem fixada"
                        >
                          📌
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {message.content}
                    </p>
                  </div>

                  <MessageActionsMenu
                    messageId={message.id}
                    content={message.content}
                    pinned={message.pinned}
                    canPin={canPin}
                    onReply={() => {
                      setReplyingTo(message);
                      inputRef.current?.focus();
                    }}
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
        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-border/30 px-3 py-1.5 text-xs text-muted">
            <span className="truncate">
              Respondendo a{" "}
              <span className="font-semibold text-secondary">
                {members[replyingTo.user_id]?.username ?? "Macaco"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancelar resposta"
              className="shrink-0 text-muted hover:text-accent"
            >
              ✕
            </button>
          </div>
        )}
        <input type="hidden" name="replyToId" value={replyingTo?.id ?? ""} />
        <input
          ref={inputRef}
          type="text"
          name="content"
          maxLength={2000}
          placeholder={`Conversar em #${channelName}`}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground outline-none focus:border-primary"
        />
        {state.error && (
          <p className="mt-1 text-xs text-danger">{state.error}</p>
        )}
      </form>

      {pinnedModalOpen && (
        <PinnedMessagesModal
          channelId={channelId}
          members={members}
          canUnpin={canPin}
          onClose={() => setPinnedModalOpen(false)}
        />
      )}
    </div>
  );
}
