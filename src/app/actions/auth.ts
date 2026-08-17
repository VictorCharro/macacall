"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: FormDataEntryValue | null): string {
  const value = String(next ?? "");
  return value.startsWith("/") ? value : "/bandos";
}

function safeErrorPage(page: FormDataEntryValue | null): string {
  const value = String(page ?? "");
  return value.startsWith("/") ? value : "/login";
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

  if (username.length < 3) {
    redirect(
      `${errorPage}?error=${encodeURIComponent("Nome de macaco precisa ter pelo menos 3 letras")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    redirect(
      `${errorPage}?error=${encodeURIComponent(error?.message ?? "Não deu pra entrar como convidado")}`,
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, username });

  if (profileError) {
    await supabase.auth.signOut();
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

  if (username.length < 3) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Nome de macaco precisa ter pelo menos 3 letras")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
