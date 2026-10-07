import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Next loads app-local env first; the monorepo file supplies missing local values.
const rootEnv = resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Docker opts in; normal Windows builds do not need symlink privileges.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  // Native shared libraries are loaded dynamically, so include their whole packages.
  outputFileTracingIncludes: {
    "/api/chatbot/**": ["../../node_modules/.pnpm/sherpa-onnx-*/**/*"]
  },
  serverExternalPackages: [
    "sherpa-onnx-node", "sherpa-onnx-win-x64",
    "sherpa-onnx-linux-x64", "sherpa-onnx-linux-arm64"
  ]
};

export default nextConfig;
