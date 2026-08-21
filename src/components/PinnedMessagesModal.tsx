"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { togglePinMessage } from "@/app/actions/messages";
import { Modal } from "@/components/Modal";
import { avatarUrl } from "@/lib/avatar";

type Member = { username: string; avatarSeed: string; avatarUrl: string | null };
type PinnedMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
};

export function PinnedMessagesModal({
  channelId,
  members,
  canUnpin,
  onClose,
}: {
  channelId: string;
  members: Record<string, Member>;
  canUnpin: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<PinnedMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("messages")
      .select("id, content, created_at, user_id")
      .eq("channel_id", channelId)
      .eq("pinned", true)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setMessages(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  return (
    <Modal onClose={onClose}>
      <h3 className="flex items-center gap-2 text-lg font-bold text-accent">
        <span aria-hidden="true">📌</span>
        Mensagens fixadas
      </h3>

      <div className="mt-3 max-h-96 overflow-y-auto">
        {messages === null ? (
          <p className="text-sm text-muted">carregando...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma mensagem fixada ainda neste canal.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => {
              const member = members[message.user_id];
              return (
                <li
                  key={message.id}
                  className="flex items-start gap-2 rounded-lg border border-border p-2"
                >
                  <img
                    src={avatarUrl(member?.avatarSeed ?? message.user_id, member?.avatarUrl)}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full bg-background object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-accent">
                      {member?.username ?? "Macaco"}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {message.content}
                    </p>
                  </div>
                  {canUnpin && (
                    <button
                      type="button"
                      onClick={async () => {
                        await togglePinMessage(message.id, false);
                        setMessages(
                          (prev) =>
                            prev?.filter((m) => m.id !== message.id) ?? null,
                        );
                      }}
                      className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-danger transition hover:bg-danger/10"
                    >
                      Desafixar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
