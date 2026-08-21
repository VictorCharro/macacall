/**
 * Every avatar in the app falls back to a generated Dicebear image seeded
 * from the user's `avatar_seed` unless they've uploaded a real photo
 * (`avatar_url`) via "Editar perfil".
 */
export function avatarUrl(seed: string, url?: string | null) {
  if (url) return url;
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}
