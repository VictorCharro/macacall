import type { SupabaseClient } from "@supabase/supabase-js";

/** A stored attachment row as fetched for rendering (message_attachments or
 * dm_message_attachments -- same shape either way). */
export type RawAttachment = {
  id: string;
  message_id: string;
  url: string;
  name: string;
  mime_type: string | null;
};

// Executable/script extensions are blocked outright -- everything else
// (images, video, pdfs, zips, whatever) is allowed, same as Discord.
const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "ps1", "vbs", "vbe", "js", "jse",
  "wsf", "wsh", "sh", "bash", "app", "dmg", "apk", "jar",
]);

const MAX_FILES_PER_MESSAGE = 6;

export type AttachmentInput = {
  path: string;
  url: string;
  name: string;
  mime_type: string | null;
  size_bytes: number;
};

/** Pulls every non-empty "attachment" file field out of a message form,
 * validating extension/size before anything touches storage. */
export function collectAttachmentFiles(formData: FormData): File[] | { error: string } {
  const files = formData
    .getAll("attachment")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) return [];
  if (files.length > MAX_FILES_PER_MESSAGE) {
    return { error: `Máximo de ${MAX_FILES_PER_MESSAGE} arquivos por mensagem` };
  }

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return { error: `Tipo de arquivo não permitido: .${ext}` };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { error: `"${file.name}" passa de 20 MB` };
    }
  }

  return files;
}

/** Uploads every file under `{scope}/{scopeId}/{messageId}-{name}` (the
 * folder structure the storage RLS policies key off of) and returns rows
 * ready to insert into message_attachments / dm_message_attachments. */
export async function uploadAttachments(
  supabase: SupabaseClient,
  files: File[],
  scope: "c" | "d",
  scopeId: string,
  messageId: string,
): Promise<AttachmentInput[] | { error: string }> {
  const results: AttachmentInput[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${scope}/${scopeId}/${messageId}-${Date.now()}-${safeName}`;

    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) return { error: error.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from("attachments").getPublicUrl(path);

    results.push({
      path,
      url: publicUrl,
      name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    });
  }

  return results;
}
