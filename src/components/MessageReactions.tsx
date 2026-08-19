"use client";

import { useState } from "react";
import type { ReactionSummary } from "@/lib/types";

/** The quick-react emojis offered on the message hover bar. */
export const QUICK_REACTIONS = ["🍌", "🦍", "❤️", "😂", "🔥"] as const;

export function MessageReactions({
  reactions,
  onToggle,
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {reactions.map((r) => (
        <ReactionPill key={r.emoji} reaction={r} onToggle={onToggle} />
      ))}
    </div>
  );
}

function ReactionPill({
  reaction,
  onToggle,
}: {
  reaction: ReactionSummary;
  onToggle: (emoji: string) => void;
}) {
  // Optimistic: the pill flips the moment it's clicked, then realtime (or the
  // action's own result) reconciles it. Without this the count lags a round
  // trip behind on every click, which reads as broken.
  const [pending, setPending] = useState(false);
  const reacted = pending ? !reaction.reacted : reaction.reacted;
  const count = reaction.count + (pending ? (reaction.reacted ? -1 : 1) : 0);

  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setPending((p) => !p);
        onToggle(reaction.emoji);
      }}
      title={reacted ? "Remover sua reação" : "Reagir"}
      className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs transition active:scale-95 ${
        reacted
          ? "border-primary/50 bg-primary/20 font-bold text-primary"
          : "border-border bg-card-2 text-foreground hover:bg-card-3"
      }`}
    >
      <span>{reaction.emoji}</span>
      <span>{count}</span>
    </button>
  );
}
