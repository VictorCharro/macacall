"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startDm, startDmCall } from "@/app/actions/dms";
import { removeFriendByUserId, blockUser } from "@/app/actions/friends";
import { ContextMenuPortal } from "@/components/ContextMenuPortal";
import { InviteToBandoModal } from "@/components/InviteToBandoModal";
import { Modal } from "@/components/Modal";

export function useFriendContextMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function open(event: React.MouseEvent) {
    event.preventDefault();
    setPos({ x: event.clientX, y: event.clientY });
  }

  function close() {
    setPos(null);
  }

  return { pos, open, close };
}

export function FriendContextMenu({
  friendId,
  friendUsername,
  pos,
  onClose,
}: {
  friendId: string;
  friendUsername: string;
  pos: { x: number; y: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [unfriendOpen, setUnfriendOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  return (
    <>
      <ContextMenuPortal x={pos.x} y={pos.y} onClose={onClose}>
        <MenuItem
          icon="💬"
          label="Iniciar conversa"
          onClick={() => {
            onClose();
            startDm(friendId);
          }}
        />
        <MenuItem
          icon="📞"
          label="Iniciar chamada"
          onClick={() => {
            onClose();
            startDmCall(friendId);
          }}
        />
        <MenuItem
          icon="🐒"
          label="Convidar para o servidor"
          onClick={() => {
            onClose();
            setInviteOpen(true);
          }}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          icon="💔"
          label="Desfazer amizade"
          danger
          onClick={() => {
            onClose();
            setUnfriendOpen(true);
          }}
        />
        <MenuItem
          icon="🚫"
          label="Bloquear"
          danger
          onClick={() => {
            onClose();
            setBlockOpen(true);
          }}
        />
      </ContextMenuPortal>

      {inviteOpen && (
        <InviteToBandoModal
          friendId={friendId}
          friendUsername={friendUsername}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {unfriendOpen && (
        <Modal onClose={() => setUnfriendOpen(false)}>
          <h3 className="text-lg font-bold text-accent">Desfazer amizade?</h3>
          <p className="mt-2 text-sm text-muted">
            Tem certeza que quer desfazer amizade com{" "}
            <span className="font-semibold text-foreground">
              {friendUsername}
            </span>
            ?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnfriendOpen(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-border/40"
            >
              Cancelar
            </button>
            <SubmitButtonAction
              onClick={async () => {
                await removeFriendByUserId(friendId);
                router.refresh();
                setUnfriendOpen(false);
              }}
              label="Desfazer amizade"
              pendingLabel="Desfazendo..."
              danger
            />
          </div>
        </Modal>
      )}

      {blockOpen && (
        <Modal onClose={() => setBlockOpen(false)}>
          <h3 className="text-lg font-bold text-accent">
            Bloquear {friendUsername}?
          </h3>
          <p className="mt-2 text-sm text-muted">
            Isso desfaz a amizade e impede pedidos futuros. Você pode
            desbloquear depois se mudar de ideia.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBlockOpen(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-border/40"
            >
              Cancelar
            </button>
            <SubmitButtonAction
              onClick={async () => {
                await blockUser(friendId);
                router.refresh();
                setBlockOpen(false);
              }}
              label="Bloquear"
              pendingLabel="Bloqueando..."
              danger
            />
          </div>
        </Modal>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition hover:bg-border/40 ${
        danger ? "text-danger" : "text-foreground"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function SubmitButtonAction({
  onClick,
  label,
  pendingLabel,
  danger,
}: {
  onClick: () => Promise<void>;
  label: string;
  pendingLabel: string;
  danger?: boolean;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await onClick();
      }}
      className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-70 ${
        danger ? "bg-danger" : "bg-primary"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
