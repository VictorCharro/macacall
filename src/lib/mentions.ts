export type Mentionable = {
  /** Stable id: user id, role id, or "everyone". */
  key: string;
  /** Text typed after "@" and matched in rendered content -- no leading @. */
  label: string;
  kind: "user" | "role" | "everyone";
};

/**
 * Finds the "@query" token the caret is currently sitting inside, scanning
 * backward from the caret to the nearest whitespace. Returns null when the
 * caret isn't inside a mention token (no "@" at the token's start, or the
 * query itself contains whitespace because the token was already closed).
 */
export function findMentionTrigger(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  let i = cursor - 1;
  while (i >= 0 && !/\s/.test(value[i])) i--;
  const start = i + 1;
  if (value[start] !== "@") return null;
  const query = value.slice(start + 1, cursor);
  if (/\s/.test(query)) return null;
  return { start, query };
}

/** Replaces the "@query" token at [start, cursor) with "@label " and reports
 * where the caret should land afterward. */
export function applyMention(
  value: string,
  start: number,
  cursor: number,
  label: string,
): { value: string; cursor: number } {
  const before = value.slice(0, start);
  const after = value.slice(cursor);
  const inserted = `@${label} `;
  return { value: before + inserted + after, cursor: before.length + inserted.length };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits message content into plain-text and mention segments for rendering.
 * Matches "@" + the longest mentionable label available at that position, so
 * a full "AnaBanana" wins over a shorter "Ana" that's also a valid mention.
 * Purely a rendering concern -- any label present in `mentionables` renders
 * as a mention regardless of whether the sender was allowed to use it.
 */
export function renderMentionSegments(
  content: string,
  mentionables: Mentionable[],
): ({ text: string } | { mention: Mentionable })[] {
  if (mentionables.length === 0) return [{ text: content }];

  const sorted = [...mentionables].sort((a, b) => b.label.length - a.label.length);
  const pattern = sorted.map((m) => escapeRegExp(m.label)).join("|");
  const re = new RegExp(`@(${pattern})(?!\\w)`, "g");
  const byLabel = new Map(mentionables.map((m) => [m.label, m]));

  const segments: ({ text: string } | { mention: Mentionable })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    if (match.index > lastIndex) segments.push({ text: content.slice(lastIndex, match.index) });
    segments.push({ mention: byLabel.get(match[1])! });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) segments.push({ text: content.slice(lastIndex) });
  return segments;
}

/** Whether any segment mentions this user directly, their roles, or @everyone. */
export function mentionsUser(
  segments: ({ text: string } | { mention: Mentionable })[],
  userId: string,
  userRoleIds: string[],
): boolean {
  return segments.some((s) => {
    if (!("mention" in s)) return false;
    if (s.mention.kind === "everyone") return true;
    if (s.mention.kind === "user") return s.mention.key === userId;
    return userRoleIds.includes(s.mention.key);
  });
}
