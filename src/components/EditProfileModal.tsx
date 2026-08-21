"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import {
  updateProfileDetails,
  uploadAvatar,
  removeAvatar,
  type AvatarActionState,
} from "@/app/actions/profile";
import { Modal } from "@/components/Modal";
import { colorFromSeed } from "@/lib/colorFromSeed";
import { avatarUrl } from "@/lib/avatar";

const initialAvatarState: AvatarActionState = {};

const BANNER_COLORS = [
  "#1f2722",
  "#059669",
  "#f59e0b",
  "#e11d48",
  "#6366f1",
  "#9b59b6",
  "#0ea5e9",
  "#78350f",
];

const MAX_BIO = 300;

export function EditProfileModal({
  username,
  avatarSeed,
  avatarUrl: photoUrl,
  initialBio,
  initialBannerColor,
  onSaved,
  onAvatarChanged,
  onClose,
}: {
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
  initialBio: string | null;
  initialBannerColor: string | null;
  onSaved: (bio: string | null, bannerColor: string | null) => void;
  onAvatarChanged: (url: string | null) => void;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(initialBio ?? "");
  // null means "no explicit choice", which falls back to the seed-derived colour.
  const [bannerColor, setBannerColor] = useState<string | null>(initialBannerColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarState, avatarAction, avatarPending] = useActionState(
    uploadAvatar,
    initialAvatarState,
  );

  useEffect(() => {
    if (avatarState.url) onAvatarChanged(avatarState.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarState]);

  async function handleRemoveAvatar() {
    setRemovingAvatar(true);
    const result = await removeAvatar();
    setRemovingAvatar(false);
    if (!result.error) onAvatarChanged(null);
  }

  const previewBanner = bannerColor ?? colorFromSeed(avatarSeed);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateProfileDetails(bio, bannerColor);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved(bio.trim() || null, bannerColor);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-accent">Editar perfil</h3>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div className="h-14 w-full" style={{ backgroundColor: previewBanner }} />
        <div className="flex items-center gap-2 bg-card-3 px-3 pb-3 pt-0">
          <form action={avatarAction} className="hidden">
            <input
              ref={fileInputRef}
              type="file"
              name="avatar"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                if (e.target.files?.length) e.target.form?.requestSubmit();
              }}
            />
          </form>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarPending}
            title="Trocar foto de perfil"
            className="group relative -mt-5 h-12 w-12 shrink-0 overflow-hidden rounded-full border-4 border-card-3 bg-background disabled:opacity-70"
          >
            <img
              src={avatarUrl(avatarSeed, avatarState.url ?? photoUrl)}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
              <Pencil className="h-4 w-4 text-white" />
            </span>
          </button>
          <span className="truncate pt-2 text-sm font-bold text-foreground">
            {username}
          </span>
          {(avatarState.url ?? photoUrl) && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={removingAvatar}
              title="Remover foto (voltar ao avatar padrão)"
              className="ml-auto mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-card-2 hover:text-danger disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {avatarState.error && (
          <p className="bg-card-3 px-3 pb-2 text-xs text-danger">{avatarState.error}</p>
        )}
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
        Cor do banner
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBannerColor(null)}
          title="Usar a cor automática do avatar"
          className={`flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${
            bannerColor === null
              ? "bg-primary text-primary-foreground"
              : "bg-card-3 text-muted hover:text-foreground"
          }`}
        >
          Automática
        </button>
        {BANNER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setBannerColor(color)}
            aria-label={`Cor ${color}`}
            className="flex h-8 w-8 items-center justify-center rounded-full transition"
            style={{ backgroundColor: color }}
          >
            {bannerColor === color && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">
        Sobre mim
      </label>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
        rows={4}
        placeholder="Conta um pouco sobre você, macaco..."
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <div className="mt-1 text-right text-[10px] text-muted">
        {bio.length}/{MAX_BIO}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-card-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-70"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
