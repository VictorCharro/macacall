import Link from "next/link";
import { signUp } from "@/app/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-5xl">🍌</span>
          <h1 className="mt-2 text-2xl font-bold text-accent">
            Junte-se ao bando
          </h1>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form action={signUp} className="flex flex-col gap-4">
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
              minLength={6}
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:brightness-95"
          >
            Criar conta
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Já é do bando?{" "}
          <Link href="/login" className="font-semibold text-secondary">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
