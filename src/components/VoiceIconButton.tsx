"use client";

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
  return (
    <div className="group/tip relative">
      <button
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

      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card-2 px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
        <p className="text-xs font-semibold text-accent">{label}</p>
        {sublabel && <p className="text-[10px] text-muted">{sublabel}</p>}
      </div>
    </div>
  );
}
