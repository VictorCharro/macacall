import { FileText } from "lucide-react";
import type { RawAttachment } from "@/lib/attachments";

/** Renders a message's attachments -- images inline, everything else as a
 * download chip. Attachment URLs are public (same pattern as bando photos),
 * so this needs no auth to fetch, just the row itself gated by RLS. */
export function AttachmentGallery({ attachments }: { attachments: RawAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) =>
        a.mime_type?.startsWith("image/") ? (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-xs overflow-hidden rounded-lg border border-border transition hover:brightness-95"
          >
            {/* Attachment URLs are arbitrary user uploads on Supabase Storage --
                next/image's remote-pattern allowlist would need every possible
                origin, so a plain <img> is the simpler fit here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.name} className="max-h-72 w-auto object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            download={a.name}
            className="flex items-center gap-2 rounded-lg border border-border bg-card-3 px-3 py-2 text-xs text-foreground transition hover:bg-card-2"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted" />
            <span className="max-w-[12rem] truncate">{a.name}</span>
          </a>
        ),
      )}
    </div>
  );
}
