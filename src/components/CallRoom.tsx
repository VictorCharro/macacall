"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

export function CallRoom({
  bandoId,
  bandoName,
}: {
  bandoId: string;
  bandoName: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bandoId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao entrar na call");
        if (!cancelled) {
          setToken(data.token);
          setServerUrl(data.url);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [bandoId]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-danger">{error}</p>
        <button
          onClick={() => router.back()}
          className="rounded-full border border-border px-4 py-2 font-semibold text-accent"
        >
          Voltar
        </button>
      </main>
    );
  }

  if (!token || !serverUrl) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <span className="animate-bounce text-4xl">🐒</span>
        <p className="text-muted">Balançando de galho em galho até a call...</p>
      </main>
    );
  }

  return (
    <div className="macacall-call flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <h1 className="font-semibold text-accent">🌴 {bandoName}</h1>
        <button
          onClick={() => router.push(`/bandos/${bandoId}`)}
          className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-muted transition hover:bg-border/40"
        >
          ← sair da tela
        </button>
      </header>
      <div className="flex-1">
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          audio
          video
          data-lk-theme="default"
          style={{ height: "100%" }}
          onDisconnected={() => router.push(`/bandos/${bandoId}`)}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    </div>
  );
}
