import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteLink } from "@/components/InviteLink";
import { VoiceChannelPresence } from "@/components/VoiceChannelPresence";

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
    .select("id, name, invite_code")
    .eq("id", id)
    .maybeSingle();

  if (!bando) notFound();

  const headerList = await headers();
  const host = headerList.get("host") ?? "macacall.vercel.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const inviteUrl = `${protocol}://${host}/join/${bando.invite_code}`;

  const { data: channel } = await supabase
    .from("channels")
    .select("id, name")
    .eq("bando_id", id)
    .eq("type", "voice")
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/bandos" className="text-sm text-muted hover:underline">
            ← seus bandos
          </Link>
          <h1 className="text-2xl font-bold text-accent">{bando.name} 🐒</h1>
        </div>
        <InviteLink url={inviteUrl} />
      </header>

      {channel && (
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="mb-1 text-sm text-muted">Canal de voz</p>
          <h2 className="mb-4 text-xl font-semibold text-accent">
            🌴 {channel.name}
          </h2>
          <Link
            href={`/bandos/${bando.id}/call`}
            className="mb-5 inline-block rounded-full bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition hover:brightness-95"
          >
            Entrar na chamada
          </Link>
          <VoiceChannelPresence bandoId={bando.id} />
        </section>
      )}
    </main>
  );
}
