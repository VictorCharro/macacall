"use client";

import { avatarUrl } from "@/lib/avatar";

type Participant = {
  id: string;
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
};

export function DmProfilePanel({
  participants,
  isGroup,
}: {
  participants: Participant[];
  isGroup: boolean;
}) {
  return (
    <aside className="scroll-hover hidden w-72 shrink-0 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain border-l border-border bg-card/60 p-4 sm:flex">
      {!isGroup && participants[0] ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <img
            src={avatarUrl(participants[0].avatarSeed, participants[0].avatarUrl)}
            alt=""
            className="h-24 w-24 rounded-full bg-background object-cover"
          />
          <div>
            <p className="text-lg font-bold text-accent">
              {participants[0].username}
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Membros — {participants.length}
          </h2>
          <ul className="flex flex-col gap-1">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-card-2"
              >
                <img
                  src={avatarUrl(p.avatarSeed, p.avatarUrl)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full bg-background object-cover"
                />
                <span className="truncate text-sm font-medium text-foreground">
                  {p.username}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
