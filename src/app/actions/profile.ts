"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
