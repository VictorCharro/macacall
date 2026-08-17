// A URL e a chave "anon" do Supabase são seguras para expor no cliente por
// design (protegidas por Row Level Security), então ficam com um valor
// padrão aqui em vez de exigir configuração de env vars no deploy.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://geuvkhkqektkkihquvii.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdldXZraGtxZWt0a2tpaHF1dmlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMDE1NzQsImV4cCI6MjEwMjU3NzU3NH0.12kYRF1a6nCAlTky_PBshJFXUYUwjBBaTuWGAt0aCqo";
