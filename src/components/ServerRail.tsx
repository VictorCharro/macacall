"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

export function ServerRail({
  bandos,
  currentUserId,
}: {
  bandos: RailBando[];
  currentUserId: string;
}) {
  const pathname = usePathname();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-border-soft bg-card-3 py-3">
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
        <div className="group relative">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            aria-label="Criar ou entrar num bando"
            className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-card text-secondary transition-all duration-200 hover:rounded-2xl hover:bg-secondary hover:text-secondary-foreground"
          >
            <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
          </button>
          <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card-2 px-3 py-1.5 text-sm font-medium text-accent opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            Criar ou entrar num bando
          </div>
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
  return (
    <div className="group relative flex w-full items-center justify-center">
      <span
        className={`absolute left-0 w-1 rounded-r-full bg-primary transition-all duration-200 ${
          active ? "h-10" : "h-0 opacity-0 group-hover:h-5 group-hover:opacity-100"
        }`}
      />
      <Link
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
      <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card-2 px-3 py-1.5 text-sm font-medium text-accent opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </div>
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
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[] | null>(
    null,
  );
  const showTooltip = hovered && !contextMenuOpen;

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
    : "rounded-[24px] bg-card text-accent group-hover:rounded-2xl group-hover:bg-secondary group-hover:text-secondary-foreground";

  return (
    <div
      className="group relative flex w-full items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={
        isOwner
          ? (e) => {
              e.preventDefault();
              setContextMenuOpen(true);
            }
          : undefined
      }
    >
      <span
        className={`absolute left-0 w-1 rounded-r-full bg-secondary transition-all duration-200 ${
          active ? "h-10" : "h-0 opacity-0 group-hover:h-5 group-hover:opacity-100"
        }`}
      />
      <Link
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
        <div className="absolute left-full top-1/2 z-20 ml-3 min-w-[10rem] -translate-y-1/2 animate-modal-in rounded-xl border border-border bg-card-2 px-3 py-2 text-sm shadow-lg">
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
      )}

      {isOwner && contextMenuOpen && (
        <BandoMenu
          bandoId={bando.id}
          bandoName={bando.name}
          onClose={() => setContextMenuOpen(false)}
        />
      )}
    </div>
  );
}
