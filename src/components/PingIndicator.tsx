"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

type EngineWithStats = {
  pcManager?: {
    subscriber?: { getStats: () => Promise<RTCStatsReport> };
    publisher?: { getStats: () => Promise<RTCStatsReport> };
  };
};

function usePingMs() {
  const room = useRoomContext();
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const engine = (room as unknown as { engine?: EngineWithStats })
          .engine;
        const pc = engine?.pcManager?.subscriber ?? engine?.pcManager?.publisher;
        if (!pc) return;

        const stats = await pc.getStats();
        let rtt: number | null = null;
        stats.forEach((report) => {
          if (
            report.type === "candidate-pair" &&
            typeof report.currentRoundTripTime === "number" &&
            (report.state === "succeeded" || report.nominated)
          ) {
            rtt = report.currentRoundTripTime;
          }
        });

        if (!cancelled && rtt !== null) setMs(Math.round(rtt * 1000));
      } catch {
        // melhor esforço: some as barras de sinal se não der pra medir
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [room]);

  return ms;
}

export function PingIndicator() {
  const ms = usePingMs();

  const tier = ms === null ? "good" : ms > 300 ? "bad" : ms > 100 ? "medium" : "good";
  const bars = tier === "bad" ? 1 : tier === "medium" ? 2 : 3;
  const colorClass =
    tier === "bad"
      ? "text-danger"
      : tier === "medium"
        ? "text-primary"
        : "text-secondary";

  return (
    <div className="group/tip relative">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        className={colorClass}
        aria-hidden="true"
      >
        <rect
          x="1"
          y="10"
          width="3"
          height="5"
          rx="0.5"
          fill="currentColor"
          opacity={bars >= 1 ? 1 : 0.25}
        />
        <rect
          x="6.5"
          y="6"
          width="3"
          height="9"
          rx="0.5"
          fill="currentColor"
          opacity={bars >= 2 ? 1 : 0.25}
        />
        <rect
          x="12"
          y="1"
          width="3"
          height="14"
          rx="0.5"
          fill="currentColor"
          opacity={bars >= 3 ? 1 : 0.25}
        />
      </svg>

      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 text-center opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
        <p className={`text-xs font-semibold ${colorClass}`}>
          {ms !== null ? `${ms} ms` : "Medindo..."}
        </p>
      </div>
    </div>
  );
}
