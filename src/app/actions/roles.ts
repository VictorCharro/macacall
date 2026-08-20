"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import type { Role } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type CreateRoleState = BandoActionState & { role?: Role };

export async function createRole(
  bandoId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<CreateRoleState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) return { error: "Dê um nome ao cargo" };

  const { supabase, user } = await requireUser();

  const { data: allowed } = await supabase.rpc("has_bando_permission", {
    p_user_id: user.id,
    p_bando_id: bandoId,
    p_bit: PERMISSIONS.MANAGE_ROLES,
  });
  if (!allowed) return { error: "Você não tem permissão pra gerenciar cargos" };

  const { data: myPosition } = await supabase.rpc("highest_role_position", {
    p_user_id: user.id,
    p_bando_id: bandoId,
  });

  const { data: maxRow } = await supabase
    .from("roles")
    .select("position")
    .eq("bando_id", bandoId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = Math.min(
    (maxRow?.position ?? 0) + 1,
    (myPosition ?? 0) - 1,
  );

  const { data: role, error } = await supabase
    .from("roles")
    .insert({
      bando_id: bandoId,
      name,
      color: String(formData.get("color") ?? "#99aab5"),
      position: Math.max(nextPosition, 1),
    })
    .select("*")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return { role: role as Role };
}

export async function updateRole(
  roleId: string,
  bandoId: string,
  updates: {
    name?: string;
    color?: string;
    icon?: string | null;
    hoist?: boolean;
    permissions_allow?: string;
    permissions_deny?: string;
  },
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("roles").update(updates).eq("id", roleId);
  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function deleteRole(
  roleId: string,
  bandoId: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

/** Persists a full drag-and-drop reorder in one go. */
export async function reorderRoles(
  bandoId: string,
  orderedRoleIds: string[],
): Promise<BandoActionState> {
  const { supabase, user } = await requireUser();

  const { data: myPosition } = await supabase.rpc("highest_role_position", {
    p_user_id: user.id,
    p_bando_id: bandoId,
  });

  // Positions are assigned bottom-up (1..N), capped below the actor's own
  // highest role so nobody can shuffle themselves above their rank — the
  // RLS update policy re-checks this server-side regardless.
  const ceiling = (myPosition ?? 0) - 1;
  const updates = orderedRoleIds.map((id, index) => ({
    id,
    position: Math.min(index + 1, Math.max(ceiling, 1)),
  }));

  for (const { id, position } of updates) {
    const { error } = await supabase
      .from("roles")
      .update({ position })
      .eq("id", id)
      .eq("is_default", false);
    if (error) return { error: error.message };
  }

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function assignRole(
  bandoId: string,
  userId: string,
  roleId: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from("member_roles").insert({
    bando_id: bandoId,
    user_id: userId,
    role_id: roleId,
  });

  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function removeRole(
  bandoId: string,
  userId: string,
  roleId: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("member_roles")
    .delete()
    .eq("bando_id", bandoId)
    .eq("user_id", userId)
    .eq("role_id", roleId);

  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function setChannelOverride(
  channelId: string,
  bandoId: string,
  target: { roleId?: string; userId?: string },
  allow: string,
  deny: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  // The uniqueness of (channel_id, role_id) / (channel_id, user_id) is enforced
  // by *partial* indexes (role_id and user_id are each nullable), which
  // ON CONFLICT cannot infer — so upsert() is not an option here. Look the row
  // up first and update it, falling back to an insert.
  const targetColumn = target.roleId ? "role_id" : "user_id";
  const targetValue = target.roleId ?? target.userId;

  const { data: existing } = await supabase
    .from("channel_permission_overrides")
    .select("id")
    .eq("channel_id", channelId)
    .eq(targetColumn, targetValue!)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("channel_permission_overrides")
        .update({ allow, deny })
        .eq("id", existing.id)
    : await supabase.from("channel_permission_overrides").insert({
        channel_id: channelId,
        role_id: target.roleId ?? null,
        user_id: target.userId ?? null,
        allow,
        deny,
      });

  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function removeChannelOverride(
  overrideId: string,
  bandoId: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("channel_permission_overrides")
    .delete()
    .eq("id", overrideId);

  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function kickMember(
  bandoId: string,
  userId: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("bando_members")
    .delete()
    .eq("bando_id", bandoId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function banMember(
  bandoId: string,
  userId: string,
  reason: string | null,
): Promise<BandoActionState> {
  const { supabase, user } = await requireUser();

  const { error: banError } = await supabase.from("banned_users").insert({
    bando_id: bandoId,
    user_id: userId,
    banned_by: user.id,
    reason,
  });
  if (banError) return { error: banError.message };

  await supabase
    .from("bando_members")
    .delete()
    .eq("bando_id", bandoId)
    .eq("user_id", userId);

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function unbanMember(
  bandoId: string,
  userId: string,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("banned_users")
    .delete()
    .eq("bando_id", bandoId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export type { PermissionKey };
