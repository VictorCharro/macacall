"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BandoMenu } from "@/components/BandoMenu";

type RailBando = {
  id: string;
  name: string;
  owner_id: string;
};

type Participant = { identity: string; name: string };

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

  return (
    <nav className="flex w-[76px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-card/60 py-3">
      <RailIcon
        href="/bandos"
        active={pathname === "/bandos"}
        label="Início"
      >
        <span className="text-xl">🍌</span>
      </RailIcon>

      {bandos.length > 0 && (
        <div className="my-1 h-px w-8 shrink-0 bg-border" />
      )}

      {bandos.map((bando) => (
        <ServerIcon
          key={bando.id}
          bando={bando}
          active={pathname.startsWith(`/bandos/${bando.id}`)}
          isOwner={bando.owner_id === currentUserId}
        />
      ))}

      <div className="my-1 h-px w-8 shrink-0 bg-border" />

      <RailIcon href="/bandos" active={false} label="Criar ou entrar num bando">
        <span className="text-xl leading-none text-secondary">+</span>
      </RailIcon>
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
    <div className="group relative">
      {active && (
        <span className="absolute -left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Link
        href={href}
        aria-label={label}
        className={`flex h-12 w-12 items-center justify-center rounded-full font-semibold transition-all duration-150 ${
          active
            ? "rounded-2xl bg-primary text-primary-foreground"
            : "bg-background text-accent hover:rounded-2xl hover:bg-primary hover:text-primary-foreground"
        }`}
      >
        {children}
      </Link>
      <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-accent opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[] | null>(
    null,
  );
  const showTooltip = hovered || menuOpen;

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

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {active && (
        <span className="absolute -left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Link
        href={`/bandos/${bando.id}`}
        className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold transition-all duration-150 ${
          active
            ? "rounded-2xl bg-primary text-primary-foreground"
            : "bg-background text-accent hover:rounded-2xl hover:bg-primary hover:text-primary-foreground"
        }`}
      >
        {getInitials(bando.name)}
      </Link>

      {showTooltip && (
        <div className="absolute left-full top-1/2 z-20 ml-3 min-w-[10rem] -translate-y-1/2 animate-modal-in rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-accent">{bando.name}</p>
            {isOwner && (
              <BandoMenu
                bandoId={bando.id}
                bandoName={bando.name}
                onOpenChange={setMenuOpen}
              />
            )}
          </div>
          <div className="mt-1.5">
            {participants === null ? (
              <p className="text-xs text-muted">carregando...</p>
            ) : participants.length === 0 ? (
              <p className="text-xs text-muted">ninguém na call 🍃</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {participants.map((p) => (
                  <li
                    key={p.identity}
                    className="text-xs font-medium text-secondary"
                  >
                    🐵 {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
