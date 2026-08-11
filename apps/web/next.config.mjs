import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the small self-hosted Docker image
  output: "standalone",
  // Monorepo: trace workspace packages (@scenes/db) from the repo root,
  // otherwise standalone output misses them and the container crashes on boot.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    serverActions: {
      // Next's default is 1mb. The dev-notes widget (submitDevNote) attaches
      // up to 5 files at 8mb raw each as base64 data URLs (~1.33x overhead),
      // so the worst case is ~53mb — stay comfortably above that or the
      // submission fails ("Body exceeded 1mb limit") before it reaches the
      // DB. This limit is global to all server actions, not just that one,
      // so it's a deliberate trade-off against a larger DoS surface.
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
