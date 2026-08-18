"use client";

type Participant = { id: string; username: string; avatarSeed: string };

export function DmProfilePanel({
  participants,
  isGroup,
}: {
  participants: Participant[];
  isGroup: boolean;
}) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card/60 p-4 sm:flex">
      {!isGroup && participants[0] ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <img
            src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(participants[0].avatarSeed)}`}
            alt=""
            className="h-24 w-24 rounded-full bg-background"
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
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-border/40"
              >
                <img
                  src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(p.avatarSeed)}`}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full bg-background"
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
