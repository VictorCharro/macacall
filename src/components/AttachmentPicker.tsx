"use client";

import { useRef, useState } from "react";
import { Paperclip, X, FileText } from "lucide-react";

/**
 * Paperclip button + hidden multi-file input, kept in sync with a DataTransfer
 * so individual files can be removed before sending (a native file input's
 * FileList is read-only and gets replaced wholesale on every pick otherwise).
 * Submits as `name="attachment"` inside the surrounding form -- the parent
 * remounts this whole form via a `key` bump after send, which is what
 * actually clears the selection, not any state here.
 */
export function AttachmentPicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function syncFiles(next: File[]) {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(next);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        name="attachment"
        multiple
        hidden
        onChange={(e) => syncFiles([...(e.target.files ?? [])])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Anexar arquivo"
        aria-label="Anexar arquivo"
        className="shrink-0 rounded p-1 text-muted transition hover:bg-card-3 hover:text-accent"
      >
        <Paperclip className="h-5 w-5" />
      </button>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2 sm:absolute sm:bottom-full sm:left-0 sm:right-0 sm:mb-1.5 sm:rounded-xl sm:border sm:border-border sm:bg-card-2 sm:p-2 sm:shadow-lg">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="flex items-center gap-1.5 rounded-lg bg-card-3 px-2 py-1 text-xs text-foreground"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => syncFiles(files.filter((_, j) => j !== i))}
                aria-label={`Remover ${f.name}`}
                className="text-muted transition hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
