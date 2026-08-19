"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, MonitorUp } from "lucide-react";
import { BandoMenu } from "@/components/BandoMenu";
import { CreateOrJoinBandoModal } from "@/components/CreateOrJoinBandoModal";

type RailBando = {
  id: string;
  name: string;
  owner_id: string;
  photo_url: string | null;
};

type Participant = { identity: string; name: string; sharingScreen: boolean };

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// The rail scrolls vertically (overflow-y-auto), which forces overflow-x to
// clip too — so a tooltip absolutely positioned off to the right of an icon
// would get cut off by the rail's own bounds. Portaling it to document.body
// and positioning it from the icon's own bounding rect sidesteps that.
function RailTooltipPortal({
  anchorRef,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: rect.right + 12, y: rect.top + rect.height / 2 });
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      style={{ position: "fixed", left: pos.x, top: pos.y, transform: "translateY(-50%)" }}
      className="pointer-events-none z-50"
    >
      {children}
    </div>,
    document.body,
  );
}

export function ServerRail({
  bandos,
  currentUserId,
}: {
  bandos: RailBando[];
  currentUserId: string;
}) {
  const pathname = usePathname();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [createHovered, setCreateHovered] = useState(false);

  return (
    <nav className="scroll-hover flex w-[72px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden overscroll-y-contain border-r border-border-soft bg-card-3 py-3">
      <RailIcon
        href="/bandos"
        active={pathname === "/bandos"}
        label="Amigos e mensagens diretas"
      >
        <span className="text-2xl">🐵</span>
      </RailIcon>

      {bandos.length > 0 && (
        <div className="my-1 h-px w-8 shrink-0 bg-border-soft" />
      )}

      {bandos.map((bando) => (
        <ServerIcon
          key={bando.id}
          bando={bando}
          active={pathname.startsWith(`/bandos/${bando.id}`)}
          isOwner={bando.owner_id === currentUserId}
        />
      ))}

      <div className="relative flex w-full items-center justify-center">
        <div
          className="relative"
          onMouseEnter={() => setCreateHovered(true)}
          onMouseLeave={() => setCreateHovered(false)}
        >
          <button
            ref={createButtonRef}
            type="button"
            onClick={() => setCreateModalOpen(true)}
            aria-label="Criar ou entrar num bando"
            className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-card text-secondary transition-all duration-200 hover:rounded-2xl hover:bg-secondary hover:text-secondary-foreground"
          >
            <Plus
              className={`h-6 w-6 transition-transform ${createHovered ? "rotate-90" : ""}`}
            />
          </button>
          {createHovered && (
            <RailTooltipPortal anchorRef={createButtonRef}>
              <div className="whitespace-nowrap rounded-lg border border-border bg-card-2 px-3 py-1.5 text-sm font-medium text-accent shadow-lg">
                Criar ou entrar num bando
              </div>
            </RailTooltipPortal>
          )}
        </div>
      </div>

      {createModalOpen && (
        <CreateOrJoinBandoModal onClose={() => setCreateModalOpen(false)} />
      )}
    </nav>
  );
}

function RailIcon({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <div
      className="relative flex w-full items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`absolute left-0 w-1 rounded-r-full bg-primary transition-all duration-200 ${
          active ? "h-10" : hovered ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />
      <Link
        ref={linkRef}
        href={href}
        aria-label={label}
        className={`flex h-12 w-12 items-center justify-center font-semibold transition-all duration-200 ${
          active
            ? "rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            : "rounded-[24px] bg-card text-accent hover:rounded-2xl hover:bg-primary hover:text-primary-foreground"
        }`}
      >
        {children}
      </Link>

      {hovered && (
        <RailTooltipPortal anchorRef={linkRef}>
          <div className="whitespace-nowrap rounded-lg border border-border bg-card-2 px-3 py-1.5 text-sm font-medium text-accent shadow-lg">
            {label}
          </div>
        </RailTooltipPortal>
      )}
    </div>
  );
}

function ServerIcon({
  bando,
  active,
  isOwner,
}: {
  bando: RailBando;
  active: boolean;
  isOwner: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [participants, setParticipants] = useState<Participant[] | null>(
    null,
  );
  const linkRef = useRef<HTMLAnchorElement>(null);
  const showTooltip = hovered && !contextMenuPos;

  useEffect(() => {
    if (!hovered) return;
    let cancelled = false;

    fetch(`/api/livekit/participants?bandoId=${bando.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setParticipants(data.participants ?? []);
      })
      .catch(() => {
        if (!cancelled) setParticipants([]);
      });

    return () => {
      cancelled = true;
    };
  }, [hovered, bando.id]);

  const shapeClasses = active
    ? "rounded-2xl bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20"
    : `rounded-[24px] bg-card text-accent ${hovered ? "rounded-2xl bg-secondary text-secondary-foreground" : ""}`;

  return (
    <div
      className="relative flex w-full items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={
        isOwner
          ? (e) => {
              e.preventDefault();
              setContextMenuPos({ x: e.clientX, y: e.clientY });
            }
          : undefined
      }
    >
      <span
        className={`absolute left-0 w-1 rounded-r-full bg-secondary transition-all duration-200 ${
          active ? "h-10" : hovered ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />
      <Link
        ref={linkRef}
        href={`/bandos/${bando.id}`}
        className={`flex h-12 w-12 items-center justify-center overflow-hidden text-sm font-bold transition-all duration-200 ${shapeClasses}`}
      >
        {bando.photo_url ? (
          <img
            src={bando.photo_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          getInitials(bando.name)
        )}
      </Link>

      {showTooltip && (
        <RailTooltipPortal anchorRef={linkRef}>
          <div className="pointer-events-auto min-w-[10rem] animate-modal-in rounded-xl border border-border bg-card-2 px-3 py-2 text-sm shadow-lg">
            <p className="font-semibold text-accent">{bando.name}</p>
            {participants && participants.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {participants.map((p) => (
                  <li
                    key={p.identity}
                    className="flex items-center justify-between gap-2 text-xs font-medium text-secondary"
                  >
                    <span className="truncate">🐵 {p.name}</span>
                    {p.sharingScreen && (
                      <MonitorUp className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </RailTooltipPortal>
      )}

      {isOwner && contextMenuPos && (
        <BandoMenu
          bandoId={bando.id}
          bandoName={bando.name}
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </div>
  );
}
