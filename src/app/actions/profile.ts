"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AvatarActionState = { error?: string; url?: string };

export async function uploadAvatar(
  _prevState: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Escolha uma imagem" };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "O arquivo precisa ser uma imagem" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "A imagem precisa ter até 5MB" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const ext = file.name.split(".").pop() || "png";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/bandos", "layout");
  return { url: publicUrl };
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bandos", "layout");
  return {};
}

export async function updateProfileDetails(
  bio: string,
  bannerColor: string | null,
): Promise<{ error?: string }> {
  if (bio.length > 300) {
    return { error: "Bio muito longa (máximo 300 caracteres)" };
  }

  // Only accept a plain hex colour -- this value is interpolated straight into
  // an inline style on the profile banner, so anything else stays out of the DB.
  if (bannerColor && !/^#[0-9a-fA-F]{6}$/.test(bannerColor)) {
    return { error: "Cor inválida" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ bio: bio.trim() || null, banner_color: bannerColor })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bandos", "layout");
  return {};
}
