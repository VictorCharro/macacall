"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const CATEGORIES: { label: string; emoji: string[] }[] = [
  {
    label: "Selva",
    emoji: ["🐵", "🙈", "🙉", "🙊", "🦍", "🦧", "🍌", "🌴", "🥥", "🌿"],
  },
  {
    label: "Reações",
    emoji: ["😀", "😂", "😅", "😍", "😎", "🤔", "😢", "😭", "😡", "🥳", "👀", "🔥"],
  },
  {
    label: "Gestos",
    emoji: ["👍", "👎", "👏", "🙏", "🤝", "💪", "✌️", "🤙", "👋", "🫡"],
  },
  {
    label: "Símbolos",
    emoji: ["❤️", "💚", "💛", "⭐", "✨", "🎉", "💯", "✅", "❌", "⚠️"],
  },
];

/** Inserts an emoji at the input's current cursor position (or appends it if
 * the input isn't focused/has no selection). */
export function EmojiPickerButton({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function insertEmoji(emoji: string) {
    const input = targetRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + emoji + input.value.slice(end);
    input.value = next;
    const cursor = start + emoji.length;
    input.setSelectionRange(cursor, cursor);
    input.focus();
  }

  return (
    <div ref={popupRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Emojis"
        aria-label="Emojis"
        className={`rounded p-1 transition ${
          open ? "text-primary" : "text-muted hover:bg-card-3 hover:text-accent"
        }`}
      >
        <Smile className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-1.5 w-72 animate-modal-in space-y-2 rounded-xl border border-border bg-card-2 p-3 shadow-lg">
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                {cat.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emoji.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertEmoji(emoji);
                    }}
                    className="rounded p-1 text-lg leading-none transition hover:scale-125 hover:bg-card-3"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
