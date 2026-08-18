import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBando, joinBandoByCode } from "@/app/actions/bandos";
import { logOut } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

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

  const { count: bandoCount } = await supabase
    .from("bando_members")
    .select("bando_id", { count: "exact", head: true })
    .eq("user_id", user.id);

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
          <SubmitButton
            pendingLabel="Saindo..."
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-border/40"
          >
            Sair
          </SubmitButton>
        </form>
      </header>

      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!bandoCount && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted">
          Você ainda não tem nenhum bando. Crie um ou entre com um código
          de convite abaixo 🍌
        </p>
      )}

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
            <SubmitButton
              pendingLabel="Criando..."
              className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground hover:brightness-95"
            >
              Criar
            </SubmitButton>
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
            <SubmitButton
              pendingLabel="Entrando..."
              className="rounded-full bg-secondary px-4 py-2 font-semibold text-secondary-foreground hover:brightness-95"
            >
              Entrar
            </SubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}
