import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = async (phase: string): Promise<NextConfig> => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    await import("@opennextjs/cloudflare").then((cloudflare) => cloudflare.initOpenNextCloudflareForDev());
  }

  return {
    typedRoutes: true
  };
};

export default nextConfig;
