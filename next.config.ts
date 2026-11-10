import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is opened at the LAN address (192.168.1.52), not only localhost.
  // Without this, Next blocks the dev client and the audit form reloads the page.
  allowedDevOrigins: ["192.168.1.52", "192.168.*.*"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
