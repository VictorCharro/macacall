"use client";

import { useState } from "react";

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted transition hover:border-primary"
    >
      {copied ? "Link copiado! 🍌" : "Copiar link de convite"}
    </button>
  );
}
