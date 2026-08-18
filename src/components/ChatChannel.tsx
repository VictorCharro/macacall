"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";
import type { BandoActionState } from "@/app/actions/bandos";

type Member = { username: string; avatarSeed: string };
type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
};

const initialState: BandoActionState = {};

export function ChatChannel({
  channelId,
  channelName,
  initialMessages,
  members,
}: {
  channelId: string;
  channelName: string;
  initialMessages: ChatMessage[];
  members: Record<string, Member>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
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
      <header className="flex items-center gap-2 border-b border-border bg-card px-6 py-3">
        <span className="text-muted">#</span>
        <h1 className="font-semibold text-accent">{channelName}</h1>
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
              return (
                <li key={message.id} className="flex items-start gap-3">
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
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {message.content}
                    </p>
                  </div>
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
          placeholder={`Conversar em #${channelName}`}
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
