import type { ReactionSummary } from "@/lib/types";

/** One row as stored: who reacted to what with which emoji. */
export type RawReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
};

/**
 * Rolls the flat reaction rows into per-message, per-emoji counts, keeping the
 * emoji order stable (first reaction wins the leftmost pill) so pills don't
 * jump around as counts change.
 */
export function summarizeReactions(
  rows: RawReaction[],
  currentUserId: string,
): Map<string, ReactionSummary[]> {
  const byMessage = new Map<string, Map<string, ReactionSummary>>();

  for (const row of rows) {
    let emojis = byMessage.get(row.message_id);
    if (!emojis) {
      emojis = new Map();
      byMessage.set(row.message_id, emojis);
    }

    const existing = emojis.get(row.emoji);
    if (existing) {
      existing.count += 1;
      existing.reacted ||= row.user_id === currentUserId;
    } else {
      emojis.set(row.emoji, {
        emoji: row.emoji,
        count: 1,
        reacted: row.user_id === currentUserId,
      });
    }
  }

  return new Map(
    [...byMessage].map(([messageId, emojis]) => [messageId, [...emojis.values()]]),
  );
}
