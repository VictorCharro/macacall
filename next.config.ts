import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
