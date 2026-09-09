"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/Modal";
import { avatarUrl } from "@/lib/avatar";

type Member = { username: string; avatarSeed: string; avatarUrl: string | null };
type PinnedMessage = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
};

/**
 * Shared by the channel and DM pinned-messages panels -- they used to be
 * two near-identical components differing only in which table/action to
 * hit and whether unpinning is gated. `fetchPinned`/`onUnpin` let each
 * caller supply that without this component knowing about channels vs DMs.
 */
export function PinnedMessagesModal({
  fetchPinned,
  onUnpin,
  canUnpin,
  onClose,
  members,
  emptyLabel,
}: {
  fetchPinned: () => Promise<PinnedMessage[]>;
  onUnpin: (messageId: string) => Promise<unknown>;
  canUnpin: boolean;
  onClose: () => void;
  members: Record<string, Member>;
  emptyLabel: string;
}) {
  const [messages, setMessages] = useState<PinnedMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPinned().then((data) => {
      if (!cancelled) setMessages(data);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="text-sm text-muted">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => {
              const member = members[message.user_id];
              return (
                <li
                  key={message.id}
                  className="flex items-start gap-2 rounded-lg border border-border p-2"
                >
                  <Image
                    src={avatarUrl(member?.avatarSeed ?? message.user_id, member?.avatarUrl)}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized={!member?.avatarUrl}
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
                        await onUnpin(message.id);
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
