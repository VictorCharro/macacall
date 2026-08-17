import Link from "next/link";
import { logIn, guestSignIn } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-5xl">🐵</span>
          <h1 className="mt-2 text-2xl font-bold text-accent">
            Bem-vindo de volta
          </h1>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form action={logIn} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-accent">
            Email
            <input
              type="email"
              name="email"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-accent">
            Senha
            <input
              type="password"
              name="password"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:brightness-95"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Ainda não tem conta?{" "}
          <Link href="/signup" className="font-semibold text-secondary">
            Criar conta
          </Link>
        </p>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>

        <form action={guestSignIn} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-accent">
            Só quero entrar rapidinho
            <input
              type="text"
              name="username"
              required
              minLength={3}
              maxLength={24}
              placeholder="Escolha um nome de macaco"
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-secondary"
            />
          </label>
          <button
            type="submit"
            className="rounded-full border border-secondary px-4 py-2 font-semibold text-secondary transition hover:bg-secondary/10"
          >
            Entrar como convidado
          </button>
          <p className="text-center text-xs text-muted">
            Sem senha, sem email — dá pra criar bando e entrar em call na
            hora. Mas se você limpar os cookies do navegador, perde o
            acesso.
          </p>
        </form>
      </div>
    </main>
  );
}
