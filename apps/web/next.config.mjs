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
};

export default nextConfig;
