"use client";

import { useRef, useState } from "react";
import { TooltipPortal } from "@/components/TooltipPortal";

export function VoiceIconButton({
  onClick,
  disabled,
  active,
  danger,
  label,
  sublabel,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition disabled:cursor-default disabled:opacity-40 ${
          danger
            ? "bg-danger/15 text-danger hover:brightness-90"
            : active
              ? "bg-secondary/20 text-secondary"
              : "text-muted hover:bg-card-2 hover:text-accent"
        }`}
      >
        {children}
      </button>

      {hovered && (
        <TooltipPortal anchorRef={buttonRef} side="top">
          <div className="whitespace-nowrap rounded-lg border border-border bg-card-2 px-2.5 py-1.5 text-center shadow-lg">
            <p className="text-xs font-semibold text-accent">{label}</p>
            {sublabel && <p className="text-[10px] text-muted">{sublabel}</p>}
          </div>
        </TooltipPortal>
      )}
    </div>
  );
}
