/**
 * Same idea as the other loading.tsx files — DmPage does 6+ Supabase
 * queries before rendering, this keeps the DM sidebar shell + a chat
 * skeleton on screen instantly instead of a frozen blank page.
 */
export default function DmLoading() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <nav className="flex w-72 shrink-0 flex-col gap-4 border-r border-border-soft bg-card p-3">
        <div className="h-6 w-24 animate-pulse rounded bg-card-2" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-card-2" />
              <div className="h-3 w-28 animate-pulse rounded bg-card-2" />
            </div>
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
    </div>
  );
}
