"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendDmMessage, type SendDmState } from "@/app/actions/dms";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";

type DmMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
};

const initialState: SendDmState = {};

export function DmChat({
  conversationId,
  otherUsername,
  otherAvatarSeed,
  currentUserId,
  currentAvatarSeed,
  initialMessages,
}: {
  conversationId: string;
  otherUsername: string;
  otherAvatarSeed: string;
  currentUserId: string;
  currentAvatarSeed: string;
  initialMessages: DmMessage[];
}) {
  const [messages, setMessages] = useState<DmMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [inputKey, setInputKey] = useState(0);

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
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent],
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

  const avatarFor = (userId: string) =>
    `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(
      userId === currentUserId ? currentAvatarSeed : otherAvatarSeed,
    )}`;
  const nameFor = (userId: string) =>
    userId === currentUserId ? "Você" : otherUsername;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border bg-card px-6 py-3">
        <img
          src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(otherAvatarSeed)}`}
          alt=""
          className="h-7 w-7 rounded-full bg-background"
        />
        <h1 className="font-semibold text-accent">{otherUsername}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">
            Comece a conversa com {otherUsername} 🍌
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <li key={message.id} className="flex items-start gap-3">
                <img
                  src={avatarFor(message.user_id)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full bg-background"
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-accent">
                      {nameFor(message.user_id)}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(message.created_at).toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {message.content}
                  </p>
                </div>
              </li>
            ))}
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
          placeholder={`Conversar com ${otherUsername}`}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-foreground outline-none focus:border-primary"
        />
        {state.error && (
          <p className="mt-1 text-xs text-danger">{state.error}</p>
        )}
      </form>
    </div>
  );
}
