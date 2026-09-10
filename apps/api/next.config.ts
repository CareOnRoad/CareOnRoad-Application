import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sherpa-onnx-node", "sherpa-onnx-win-x64"]
};

export default nextConfig;
