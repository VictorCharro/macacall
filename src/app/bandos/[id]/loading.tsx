/**
 * Shown instantly by Next.js while the bando layout's Server Component
 * queries (channels, members, roles, permissions...) are still in flight —
 * without this, switching servers left the screen blank/frozen until every
 * query resolved.
 */
export default function BandoLoading() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <nav className="flex w-60 shrink-0 flex-col gap-4 border-r border-border-soft bg-card px-2 py-3">
        <div className="h-6 w-32 animate-pulse rounded bg-card-2" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-card-2" />
          ))}
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center border-b border-border-soft px-4">
          <div className="h-4 w-40 animate-pulse rounded bg-card-2" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-card-2"
              style={{ width: `${40 + ((i * 17) % 40)}%` }}
            />
          ))}
        </div>
      </div>

      <aside className="hidden w-60 shrink-0 flex-col gap-3 border-l border-border-soft bg-card p-3 sm:flex">
        <div className="h-4 w-24 animate-pulse rounded bg-card-2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-card-2" />
            <div className="h-3 w-24 animate-pulse rounded bg-card-2" />
          </div>
        ))}
      </aside>
    </div>
  );
}
