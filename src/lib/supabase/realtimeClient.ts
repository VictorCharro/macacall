import { createClient } from "./client";

export async function createRealtimeClient() {
  const supabase = createClient();
  await supabase.realtime.setAuth();
  return supabase;
}
