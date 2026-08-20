"use server";

import { createClient } from "@/lib/supabase/server";

export type AuditEntry = {
  id: string;
  actor_id: string;
  action: string;
  target_label: string | null;
  created_at: string;
  profiles: { username: string } | null;
};

/** Most recent 100 entries -- RLS already restricts this to admins, so no
 * separate permission check needed here. */
export async function listAuditLog(bandoId: string): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, target_label, created_at, profiles(username)")
    .eq("bando_id", bandoId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []) as unknown as AuditEntry[];
}
