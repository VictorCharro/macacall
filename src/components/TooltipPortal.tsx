"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Any panel with `overflow-y-auto` clips `overflow-x` too, so a tooltip
 * absolutely positioned relative to an icon near that panel's edge gets cut
 * off instead of overflowing visibly. Portaling to document.body and
 * positioning from the anchor's own bounding rect sidesteps that entirely.
 */
export function TooltipPortal({
  anchorRef,
  side = "right",
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Which side of the anchor the tooltip sits on. */
  side?: "right" | "top";
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(
      side === "right"
        ? { x: rect.right + 12, y: rect.top + rect.height / 2 }
        : { x: rect.left + rect.width / 2, y: rect.top - 8 },
    );
  }, [anchorRef, side]);

  if (!pos) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: side === "right" ? "translateY(-50%)" : "translate(-50%, -100%)",
      }}
      className="pointer-events-none z-50"
    >
      {children}
    </div>,
    document.body,
  );
}
