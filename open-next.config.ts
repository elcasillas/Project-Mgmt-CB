import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const cloudflareConfig = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache
});

const openNextConfig = {
  ...cloudflareConfig,
  buildCommand: "npm run next:build"
};

export default openNextConfig;
