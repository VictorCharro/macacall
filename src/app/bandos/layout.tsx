import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServerRail } from "@/components/ServerRail";
import { CallProvider } from "@/components/CallProvider";
import { PresenceProvider } from "@/components/PresenceProvider";
import type { PresenceStatus } from "@/lib/types";

export default async function BandosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("bando_members")
    .select("bandos(id, name, owner_id, photo_url)")
    .eq("user_id", user.id);

  const bandos = (memberships ?? [])
    .map(
      (m) =>
        m.bandos as unknown as {
          id: string;
          name: string;
          owner_id: string;
          photo_url: string | null;
        },
    )
    .filter(Boolean);

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <PresenceProvider
      userId={user.id}
      initialStatus={(ownProfile?.status as PresenceStatus) ?? "online"}
    >
      <CallProvider>
        <div className="fixed inset-0 flex overflow-hidden">
          <ServerRail bandos={bandos} currentUserId={user.id} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </CallProvider>
    </PresenceProvider>
  );
}
