import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeOnboarding } from "@/app/actions/auth";

export default async function OnboardingPage({
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
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) redirect("/bandos");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-5xl">🙈</span>
          <h1 className="mt-2 text-2xl font-bold text-accent">
            Escolha seu nome de macaco
          </h1>
          <p className="mt-1 text-sm text-muted">
            É assim que o bando vai te reconhecer
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form action={completeOnboarding} className="flex flex-col gap-4">
          <input
            type="text"
            name="username"
            required
            minLength={3}
            maxLength={24}
            placeholder="MacacoVoador123"
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:brightness-95"
          >
            Confirmar
          </button>
        </form>
      </div>
    </main>
  );
}
