"use server";

import { createClient } from "@/lib/supabase/server";

export type ViewedProfile = {
  id: string;
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
  bio: string | null;
  bannerColor: string | null;
  statusMessage: string | null;
  isSelf: boolean;
};

/** Fetches whatever a click-to-view profile popup needs, for any member --
 * used from chat names, voice tiles, wherever a name/avatar shows up. RLS
 * on profiles already allows any authenticated user to read any profile. */
export async function getUserProfile(userId: string): Promise<ViewedProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_seed, avatar_url, bio, banner_color, status_message")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    username: data.username,
    avatarSeed: data.avatar_seed,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    bannerColor: data.banner_color,
    statusMessage: data.status_message,
    isSelf: data.id === user.id,
  };
}
