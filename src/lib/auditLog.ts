import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "kick_member"
  | "ban_member"
  | "unban_member"
  | "create_role"
  | "delete_role"
  | "create_channel"
  | "delete_channel"
  | "rename_bando";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  kick_member: "expulsou",
  ban_member: "baniu",
  unban_member: "desbaniu",
  create_role: "criou o cargo",
  delete_role: "excluiu o cargo",
  create_channel: "criou o canal",
  delete_channel: "excluiu o canal",
  rename_bando: "renomeou o bando para",
};

/** Best-effort: a logging failure shouldn't roll back or fail the action
 * that triggered it, so errors are swallowed rather than surfaced. */
export async function logAudit(
  supabase: SupabaseClient,
  bandoId: string,
  actorId: string,
  action: AuditAction,
  targetLabel?: string,
) {
  await supabase
    .from("audit_log")
    .insert({ bando_id: bandoId, actor_id: actorId, action, target_label: targetLabel })
    .then(
      () => {},
      () => {},
    );
}
