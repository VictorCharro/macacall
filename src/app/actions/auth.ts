"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/bandos");
}

export async function guestSignIn(formData: FormData) {
  const username = String(formData.get("username")).trim();

  if (username.length < 3) {
    redirect(
      `/login?error=${encodeURIComponent("Nome de macaco precisa ter pelo menos 3 letras")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Não deu pra entrar como convidado")}`);
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
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect("/bandos");
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
