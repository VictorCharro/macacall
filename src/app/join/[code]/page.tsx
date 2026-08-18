import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinBandoNoRevalidate } from "@/app/actions/bandos";
import { guestSignIn } from "@/app/actions/auth";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code: rawCode } = await params;
  const { error } = await searchParams;
  const code = rawCode.toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await joinBandoNoRevalidate(code);
  }

  const { data: preview } = await supabase
    .rpc("get_bando_preview_by_invite_code", { p_code: code })
    .maybeSingle<{ id: string; name: string }>();

  if (!preview) notFound();

  const nextPath = `/join/${code}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <span className="text-5xl">🐒</span>
        <p className="mt-2 text-sm text-muted">Você foi convidado pro bando</p>
        <h1 className="mb-6 text-2xl font-bold text-accent">
          {preview.name}
        </h1>

        {error && (
          <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-left text-sm text-danger">
            {error}
          </p>
        )}

        <form action={guestSignIn} className="flex flex-col gap-3 text-left">
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="errorPage" value={nextPath} />
          <label className="flex flex-col gap-1 text-sm font-medium text-accent">
            Escolha um nome de macaco
            <input
              type="text"
              name="username"
              required
              minLength={3}
              maxLength={24}
              placeholder="MacacoVoador123"
              className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:brightness-95"
          >
            Entrar no bando 🍌
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="font-semibold text-secondary"
          >
            Entrar com email
          </Link>
        </p>
      </div>
    </main>
  );
}
