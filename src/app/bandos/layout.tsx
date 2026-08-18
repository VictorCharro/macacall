import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServerRail } from "@/components/ServerRail";
import { CallProvider } from "@/components/CallProvider";

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

  return (
    <CallProvider>
      <div className="flex flex-1 overflow-hidden">
        <ServerRail bandos={bandos} currentUserId={user.id} />
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </CallProvider>
  );
}
