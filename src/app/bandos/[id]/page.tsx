import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

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

  const { data: channel } = await supabase
    .from("channels")
    .select("id, name")
    .eq("bando_id", id)
    .eq("type", "voice")
    .limit(1)
    .maybeSingle();

  const { data: members } = await supabase
    .from("bando_members")
    .select("role, profiles(id, username, avatar_seed, created_at)")
    .eq("bando_id", id);

  const memberList = (members ?? [])
    .map((m) => ({ role: m.role, profile: m.profiles as unknown as Profile }))
    .filter((m) => m.profile);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/bandos" className="text-sm text-muted hover:underline">
            ← seus bandos
          </Link>
          <h1 className="text-2xl font-bold text-accent">{bando.name} 🐒</h1>
        </div>
        <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted">
          Convite: <span className="font-mono font-semibold text-accent">{bando.invite_code}</span>
        </div>
      </header>

      {channel && (
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="mb-1 text-sm text-muted">Canal de voz</p>
          <h2 className="mb-4 text-xl font-semibold text-accent">
            🌴 {channel.name}
          </h2>
          <Link
            href={`/bandos/${bando.id}/call`}
            className="inline-block rounded-full bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition hover:brightness-95"
          >
            Entrar na chamada
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-accent">
          Membros do bando ({memberList.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {memberList.map(({ role, profile }) => (
            <li
              key={profile.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="font-medium text-accent">
                {profile.username}
              </span>
              {role === "owner" && (
                <span className="text-sm text-muted">👑 dono</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
