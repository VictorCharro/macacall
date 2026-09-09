import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";

/**
 * Shared by every Server Action that needs "who's calling, and bail to
 * /login if nobody is" -- this exact 4-line block used to be copy-pasted by
 * hand in every actions/*.ts file (roles.ts had its own local copy).
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getCachedUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
