import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Dicebear-generated avatars (lib/avatar.ts) and Supabase Storage
      // (real avatar/bando photo uploads, "*.supabase.co" instead of the
      // one hardcoded project host so this doesn't need updating if the
      // project ever moves).
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    // Default Server Action body limit (1MB) is too small for message
    // attachments -- matches the 20MB per-file cap enforced in
    // lib/attachments.ts.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
