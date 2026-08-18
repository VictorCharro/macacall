import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/bandos");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-7xl">🐵</span>
      <h1 className="text-4xl font-bold text-accent sm:text-5xl">MacaCall</h1>
      <p className="max-w-md text-lg text-muted">
        O bando todo numa chamada só: voz, vídeo e tela compartilhada. De
        graça, pra você e seus amigos.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition hover:brightness-95"
        >
          Entrar no bando
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-border bg-card px-6 py-3 font-semibold text-accent transition hover:bg-card-2"
        >
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}
