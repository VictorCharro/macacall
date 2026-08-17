import Link from "next/link";

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <span className="text-5xl">📬</span>
        <h1 className="mt-3 text-2xl font-bold text-accent">
          Confira seu email
        </h1>
        <p className="mt-2 text-muted">
          Mandamos um link de confirmação para{" "}
          <span className="font-semibold text-accent">{email}</span>.
          Clique nele para acordar seu macaco e entrar no bando.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground transition hover:brightness-95"
        >
          Já confirmei, entrar
        </Link>
      </div>
    </main>
  );
}
