import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBando, joinBandoByCode } from "@/app/actions/bandos";
import { logOut } from "@/app/actions/auth";
import type { Bando } from "@/lib/types";

export default async function BandosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const { data: memberships } = await supabase
    .from("bando_members")
    .select("bandos(id, name, owner_id, invite_code, created_at)")
    .eq("user_id", user.id);

  const bandos = (memberships ?? [])
    .map((m) => m.bandos as unknown as Bando)
    .filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">E aí,</p>
          <h1 className="text-2xl font-bold text-accent">
            {profile.username} 🐵
          </h1>
        </div>
        <form action={logOut}>
          <button className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-border/40">
            Sair
          </button>
        </form>
      </header>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-accent">Seus bandos</h2>
        {bandos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted">
            Você ainda não tem nenhum bando. Crie um ou entre com um código
            de convite abaixo 🍌
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bandos.map((bando) => (
              <li key={bando.id}>
                <Link
                  href={`/bandos/${bando.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-primary"
                >
                  <span className="font-semibold text-accent">
                    {bando.name}
                  </span>
                  <span className="text-sm text-muted">
                    código: {bando.invite_code}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-accent">Criar um bando</h3>
          <form action={createBando} className="flex flex-col gap-3">
            <input
              type="text"
              name="name"
              required
              minLength={2}
              placeholder="Nome do bando"
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:brightness-95"
            >
              Criar
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-accent">
            Entrar com código
          </h3>
          <form action={joinBandoByCode} className="flex flex-col gap-3">
            <input
              type="text"
              name="code"
              required
              minLength={6}
              maxLength={6}
              placeholder="Código de convite"
              className="rounded-lg border border-border bg-background px-3 py-2 uppercase text-foreground outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="rounded-full bg-secondary px-4 py-2 font-semibold text-secondary-foreground transition hover:brightness-95"
            >
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
