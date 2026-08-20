import { renderMentionSegments, type Mentionable } from "@/lib/mentions";

/** Renders message content with @mentions highlighted as pills, matching
 * Discord's inline style -- a mention that targets the reader gets a
 * stronger fill so it pops out of the rest of the message. */
export function MentionText({
  content,
  mentionables,
  isMentioningMe,
}: {
  content: string;
  mentionables: Mentionable[];
  /** Per-segment: is this particular mention aimed at the current reader? */
  isMentioningMe: (m: Mentionable) => boolean;
}) {
  const segments = renderMentionSegments(content, mentionables);

  return (
    <>
      {segments.map((seg, i) =>
        "text" in seg ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <span
            key={i}
            className={`rounded px-1 py-0.5 font-medium ${
              isMentioningMe(seg.mention)
                ? "bg-primary/30 text-primary"
                : "bg-secondary/15 text-secondary"
            }`}
          >
            @{seg.mention.label}
          </span>
        ),
      )}
    </>
  );
}
