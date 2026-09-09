import { useEffect, useMemo, useRef, useState } from "react";
import { createRealtimeClient } from "@/lib/supabase/realtimeClient";
import { summarizeReactions, type RawReaction } from "@/lib/reactions";
import type { RawAttachment } from "@/lib/attachments";

/**
 * Shared by ChatChannel, DmChat and ThreadPanel: message/reaction/attachment
 * state, the Realtime wiring for all three tables, the two derived lookup
 * maps, and the scroll-to-bottom ref. These three components used to
 * hand-roll an almost identical ~80-line copy of this each.
 *
 * Each caller's own quirks stay in the caller, not here:
 *  - ChatChannel also tracks `threads` and needs to redirect thread replies
 *    away from the main feed into a reply-count bump instead -- that's what
 *    `onInsert` is for (return `true` to skip adding the row to `messages`,
 *    the caller has already handled it some other way).
 *  - ThreadPanel loads its initial data asynchronously (`getThreadMessages`)
 *    rather than from props -- it just calls the returned setters once that
 *    resolves, instead of passing `initial*` props.
 */
export function useMessageFeed<TMessage extends { id: string }>({
  channelTopic,
  table,
  filterColumn,
  filterValue,
  reactionsTable,
  attachmentsTable,
  currentUserId,
  initialMessages = [],
  initialReactions = [],
  initialAttachments = [],
  onInsert,
}: {
  /** Realtime channel/topic name, e.g. `messages:${channelId}`. */
  channelTopic: string;
  table: string;
  filterColumn: string;
  filterValue: string;
  reactionsTable: string;
  attachmentsTable: string;
  currentUserId: string;
  initialMessages?: TMessage[];
  initialReactions?: RawReaction[];
  initialAttachments?: RawAttachment[];
  /** Return true to prevent a newly-INSERTed row from being added to
   * `messages` -- the caller already handled it some other way. */
  onInsert?: (row: TMessage & Record<string, unknown>) => boolean | void;
}) {
  const [messages, setMessages] = useState<TMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<RawReaction[]>(initialReactions);
  const [attachments, setAttachments] = useState<RawAttachment[]>(initialAttachments);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ref instead of a dependency so callers don't need to `useCallback` an
  // inline `onInsert` just to avoid resubscribing every render. Updated in
  // an effect, not during render -- ref writes aren't safe there.
  const onInsertRef = useRef(onInsert);
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(channelTopic)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table,
            filter: `${filterColumn}=eq.${filterValue}`,
          },
          (payload) => {
            const row = payload.new as TMessage & Record<string, unknown>;
            if (onInsertRef.current?.(row)) return;
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
            table,
            filter: `${filterColumn}=eq.${filterValue}`,
          },
          (payload) => {
            const row = payload.new as Partial<TMessage> & { id: string };
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
            table,
            filter: `${filterColumn}=eq.${filterValue}`,
          },
          (payload) => {
            const row = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
          },
        )
        // Attachments finish uploading slightly after the message row
        // itself (a separate insert in the same server action), so other
        // clients see the text first and files pop in a beat later.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: attachmentsTable },
          (payload) => {
            const row = payload.new as RawAttachment;
            setAttachments((prev) =>
              prev.some((a) => a.id === row.id) ? prev : [...prev, row],
            );
          },
        )
        // Reactions carry no channel/conversation/thread id, so this
        // listens broadly and relies on RLS to only stream rows this user
        // can already see.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: reactionsTable },
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
          { event: "DELETE", schema: "public", table: reactionsTable },
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
  }, [channelTopic, table, filterColumn, filterValue, reactionsTable, attachmentsTable]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return {
    messages,
    setMessages,
    reactions,
    setReactions,
    attachments,
    setAttachments,
    reactionsByMessage,
    attachmentsByMessage,
    bottomRef,
  };
}
