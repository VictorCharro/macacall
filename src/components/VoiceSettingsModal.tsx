"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mic, Video, Volume2 } from "lucide-react";
import { useCall, type DeviceKind } from "@/components/CallProvider";

type DeviceOption = { deviceId: string; label: string };

const SUPPORTS_OUTPUT_SELECTION =
  typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

export function VoiceSettingsModal({ onClose }: { onClose: () => void }) {
  const { devicePreferences, setDevicePreference } = useCall();
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<DeviceOption[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const meterStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDevices() {
      try {
        // Labels are blank until permission is granted at least once --
        // this both unlocks them and doubles as the mic level meter's source.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: devicePreferences.audioinput
            ? { deviceId: devicePreferences.audioinput }
            : true,
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        meterStreamRef.current = stream;
        startMeter(stream);

        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setMics(
          all
            .filter((d) => d.kind === "audioinput")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microfone ${i + 1}` })),
        );
        setCameras(
          all
            .filter((d) => d.kind === "videoinput")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Câmera ${i + 1}` })),
        );
        setSpeakers(
          all
            .filter((d) => d.kind === "audiooutput")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Saída ${i + 1}` })),
        );
      } catch {
        if (!cancelled) {
          setPermissionError(
            "Não consegui acessar o microfone -- verifique a permissão do navegador.",
          );
        }
      }
    }

    loadDevices();
    return () => {
      cancelled = true;
      stopMeter();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  function startMeter(stream: MediaStream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = ctx;

    const data = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const centered = v - 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length) / 128;
      setLevel(Math.min(1, rms * 4));
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioContextRef.current?.close().catch(() => {});
    meterStreamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function selectDevice(kind: DeviceKind, deviceId: string) {
    setDevicePreference(kind, deviceId);
    if (kind === "audioinput") {
      // Restart the meter against the newly chosen mic.
      stopMeter();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId },
          video: false,
        });
        meterStreamRef.current = stream;
        startMeter(stream);
      } catch {
        // Device picked but meter restart failed -- not worth surfacing.
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-accent">Configurações de voz e vídeo</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-muted transition hover:bg-card-2 hover:text-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {permissionError ? (
          <p className="text-sm text-danger">{permissionError}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <Mic className="h-3.5 w-3.5" />
                Microfone
              </label>
              <select
                value={devicePreferences.audioinput ?? ""}
                onChange={(e) => selectDevice("audioinput", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Padrão do sistema</option>
                {mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
              </select>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-card-3">
                <div
                  className="h-full rounded-full bg-secondary transition-[width] duration-75"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">Fale algo pra testar o nível do mic.</p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <Video className="h-3.5 w-3.5" />
                Câmera
              </label>
              <select
                value={devicePreferences.videoinput ?? ""}
                onChange={(e) => selectDevice("videoinput", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Padrão do sistema</option>
                {cameras.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {SUPPORTS_OUTPUT_SELECTION && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  <Volume2 className="h-3.5 w-3.5" />
                  Saída de áudio
                </label>
                <select
                  value={devicePreferences.audiooutput ?? ""}
                  onChange={(e) => selectDevice("audiooutput", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">Padrão do sistema</option>
                  {speakers.map((s) => (
                    <option key={s.deviceId} value={s.deviceId}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-[11px] text-muted">
              Trocar aqui aplica na hora se você já estiver numa call, e vale como padrão pra
              próxima vez que entrar em uma.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
