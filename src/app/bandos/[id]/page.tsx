import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BandoPage({
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
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!bando) notFound();

  const { data: channels } = await supabase
    .from("channels")
    .select("id, type, created_at")
    .eq("bando_id", id)
    .order("created_at");

  const firstChannel =
    (channels ?? []).find((c) => c.type === "text") ?? channels?.[0];

  if (!firstChannel) notFound();

  redirect(`/bandos/${id}/${firstChannel.id}`);
}
