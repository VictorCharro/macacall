"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffectiveStatus } from "@/components/FriendRow";
import { UserPanel } from "@/components/UserPanel";

type DmEntry = {
  conversationId: string;
  id: string;
  username: string;
  avatarSeed: string;
};

export function FriendsSidebar({
  selfUsername,
  selfAvatarSeed,
  dms,
}: {
  selfUsername: string;
  selfAvatarSeed: string;
  dms: DmEntry[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex w-72 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="border-b border-border p-3">
        <button
          type="button"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted"
        >
          Encontre ou comece uma conversa
        </button>
      </div>

      <div className="flex flex-col gap-1 px-2 py-3">
        <Link
          href="/bandos"
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            pathname === "/bandos"
              ? "bg-border/40 text-accent"
              : "text-muted hover:bg-border/30 hover:text-accent"
          }`}
        >
          <span aria-hidden="true">🐒</span>
          Amigos
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Mensagens diretas
        </p>
        {dms.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted">
            Nenhuma conversa ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {dms.map((dm) => (
              <DmListItem
                key={dm.conversationId}
                dm={dm}
                active={pathname === `/bandos/dm/${dm.conversationId}`}
              />
            ))}
          </ul>
        )}
      </div>

      <UserPanel username={selfUsername} avatarSeed={selfAvatarSeed} />
    </nav>
  );
}

function DmListItem({ dm, active }: { dm: DmEntry; active: boolean }) {
  const status = useEffectiveStatus(dm.id);

  return (
    <li>
      <Link
        href={`/bandos/dm/${dm.conversationId}`}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-border/60 text-accent"
            : "text-muted hover:bg-border/30 hover:text-accent"
        }`}
      >
        <div className="relative shrink-0">
          <img
            src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(dm.avatarSeed)}`}
            alt=""
            className="h-7 w-7 rounded-full bg-background"
          />
          <span
            className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card ${
              status ? "bg-secondary" : "bg-muted"
            }`}
            aria-hidden="true"
          />
        </div>
        <span className="truncate">{dm.username}</span>
      </Link>
    </li>
  );
}
