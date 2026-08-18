import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MembersSidebar } from "@/components/MembersSidebar";
import type { Profile } from "@/lib/types";

export default async function BandoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bando } = await supabase
    .from("bandos")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!bando) notFound();

  const { data: members } = await supabase
    .from("bando_members")
    .select("profiles(id, username, avatar_seed)")
    .eq("bando_id", id);

  const memberList = (members ?? [])
    .map(
      (m) =>
        m.profiles as unknown as Pick<Profile, "id" | "username" | "avatar_seed">,
    )
    .filter(Boolean)
    .map((profile) => ({
      id: profile.id,
      username: profile.username,
      avatarSeed: profile.avatar_seed,
      isOwner: profile.id === bando.owner_id,
    }));

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      <MembersSidebar bandoId={id} members={memberList} />
    </div>
  );
}
