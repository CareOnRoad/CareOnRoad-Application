import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Next loads app-local env first; the monorepo file supplies missing local values.
const rootEnv = resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  serverExternalPackages: ["sherpa-onnx-node", "sherpa-onnx-win-x64"]
};

export default nextConfig;
