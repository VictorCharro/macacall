"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = String(next ?? "");
  return value.startsWith("/") ? value : "/bandos";
}

function safeErrorPage(page: FormDataEntryValue | null): string {
  const value = String(page ?? "");
  return value.startsWith("/") ? value : "/login";
}

// Matches the `maxLength={24}` already on every username input in the UI
// (guest sign-in, onboarding, login) -- this was never enforced server-side,
// so a direct POST could still write an arbitrarily long username.
const USERNAME_MAX_LENGTH = 24;

function isValidUsernameLength(username: string) {
  return username.length >= 3 && username.length <= USERNAME_MAX_LENGTH;
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    redirect(`/signup/confirme-email?email=${encodeURIComponent(email)}`);
  }

  redirect("/onboarding");
}

export async function logIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}

export async function guestSignIn(formData: FormData) {
  const username = String(formData.get("username")).trim();
  const next = safeNext(formData.get("next"));
  const errorPage = safeErrorPage(formData.get("errorPage"));

  if (!isValidUsernameLength(username)) {
    redirect(
      `${errorPage}?error=${encodeURIComponent(`Nome de macaco precisa ter entre 3 e ${USERNAME_MAX_LENGTH} letras`)}`,
    );
  }

  const supabase = await createClient();

  const {
    data: { user: existingUser },
  } = await getCachedUser();

  let user = existingUser;
  let isNewUser = false;

  if (!user) {
    // Only guards *creating a new* guest account -- an already-signed-in
    // guest changing their username again isn't the abuse case this is
    // for. 8 new guest accounts per 10 min per IP is generous for real
    // friends joining a call, not for a script farming accounts.
    if (isRateLimited(`guest-signin:${await clientIp()}`, 8, 10 * 60 * 1000)) {
      redirect(
        `${errorPage}?error=${encodeURIComponent("Muitas tentativas -- espera um pouco e tenta de novo")}`,
      );
    }

    const { data, error } = await supabase.auth.signInAnonymously();

    if (error || !data.user) {
      redirect(
        `${errorPage}?error=${encodeURIComponent(error?.message ?? "Não deu pra entrar como convidado")}`,
      );
    }

    user = data.user;
    isNewUser = true;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username }, { onConflict: "id" });

  if (profileError) {
    if (isNewUser) {
      await supabase.auth.signOut();
    }
    const message =
      profileError.code === "23505"
        ? "Esse nome já está em uso, tenta outro"
        : profileError.message;
    redirect(`${errorPage}?error=${encodeURIComponent(message)}`);
  }

  redirect(next);
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function completeOnboarding(formData: FormData) {
  const username = String(formData.get("username")).trim();

  if (!isValidUsernameLength(username)) {
    redirect(
      `/onboarding?error=${encodeURIComponent(`Nome de macaco precisa ter entre 3 e ${USERNAME_MAX_LENGTH} letras`)}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/bandos");
}
