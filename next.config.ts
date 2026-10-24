import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Recovered reference data and live saves are external runtime inputs.
  outputFileTracingExcludes: {
    "/api/rpg/session": ["./data/rpg-reference/**/*", "./.data/rpg/**/*"],
  },
  env: {
    NEXT_PUBLIC_APP_REVISION: process.env.RENDER_GIT_COMMIT || "development",
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
