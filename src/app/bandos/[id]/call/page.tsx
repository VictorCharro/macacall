import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallRoom } from "@/components/CallRoom";

export default async function CallPage({
  params,
}: {
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
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!bando) notFound();

  return <CallRoom bandoId={bando.id} bandoName={bando.name} />;
}
