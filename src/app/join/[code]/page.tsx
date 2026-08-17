import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinBando } from "@/app/actions/bandos";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Entre para aceitar o convite")}`);
  }

  await joinBando(code.toUpperCase());
}
