"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useEffectiveStatus } from "@/components/FriendRow";
import {
  FriendContextMenu,
  useFriendContextMenu,
} from "@/components/FriendContextMenu";
import { UserPanel } from "@/components/UserPanel";
import { avatarUrl } from "@/lib/avatar";

type DmEntry = {
  conversationId: string;
  id: string;
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
  isGroup?: boolean;
  unread?: number;
};

export function FriendsSidebar({
  selfUsername,
  selfAvatarSeed,
  selfAvatarUrl,
  dms,
}: {
  selfUsername: string;
  selfAvatarSeed: string;
  selfAvatarUrl: string | null;
  dms: DmEntry[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex w-72 shrink-0 flex-col border-r border-border-soft bg-card">
      <div className="border-b border-border-soft p-3">
        <button
          type="button"
          className="relative w-full rounded bg-card-3 py-1.5 pl-8 pr-3 text-left text-xs text-muted transition hover:bg-card-2"
        >
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          Encontre ou comece uma conversa
        </button>
      </div>

      <div className="flex flex-col gap-1 px-2 py-3">
        <Link
          href="/bandos"
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            pathname === "/bandos"
              ? "bg-card-2 text-accent"
              : "text-muted hover:bg-card-2 hover:text-accent"
          }`}
        >
          <span aria-hidden="true">🐒</span>
          Amigos
        </Link>
      </div>

      <div className="scroll-hover flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 pb-3">
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

      <UserPanel
        username={selfUsername}
        avatarSeed={selfAvatarSeed}
        avatarUrl={selfAvatarUrl}
      />
    </nav>
  );
}

function DmListItem({ dm, active }: { dm: DmEntry; active: boolean }) {
  const status = useEffectiveStatus(dm.id);
  const menu = useFriendContextMenu();

  return (
    <li onContextMenu={dm.isGroup ? undefined : menu.open}>
      <Link
        href={`/bandos/dm/${dm.conversationId}`}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-card-2 text-accent"
            : "text-muted hover:bg-card-2 hover:text-accent"
        }`}
      >
        <div className="relative shrink-0">
          <img
            src={avatarUrl(dm.avatarSeed, dm.avatarUrl)}
            alt=""
            className="h-7 w-7 rounded-full bg-background object-cover"
          />
          <span
            className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card ${
              status ? "bg-secondary" : "bg-muted"
            }`}
            aria-hidden="true"
          />
        </div>
        <span
          className={`min-w-0 flex-1 truncate ${!active && dm.unread ? "font-bold text-foreground" : ""}`}
        >
          {dm.username}
        </span>
        {!active && !!dm.unread && (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
            {dm.unread > 99 ? "99+" : dm.unread}
          </span>
        )}
      </Link>

      {menu.pos && (
        <FriendContextMenu
          friendId={dm.id}
          friendUsername={dm.username}
          pos={menu.pos}
          onClose={menu.close}
        />
      )}
    </li>
  );
}
