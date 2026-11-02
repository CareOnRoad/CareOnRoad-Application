/**
 * Module resolve hook cho `node --test` ở apps/mobile.
 *
 * Mục đích: cho phép test import module app bằng alias `@/...` giống hệt
 * runtime (Expo/Metro resolve `@/*` → `src/*` theo `tsconfig.json`).
 *
 * Node không đọc `tsconfig.json` "paths" nên ta tự map trong hook này.
 * Không thêm dependency mới — chỉ dùng `node:module` API có sẵn.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(process.cwd());
const projectRootUrl = pathToFileURL(projectRoot + path.sep).href;

/**
 * Resolve `@/lib/api` → `<projectRoot>/src/lib/api.ts`.
 *
 * Extension được thử theo thứ tự: `.ts`, `.tsx`, rồi `/index.ts`.
 * File phải tồn tại thật; nếu không, ta trả `null` để Node tiếp tục resolve
 * bình thường (giữ nguyên hành vi cho `node_modules` và import tương đối).
 */
export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const relative = specifier.slice("@/".length);
  const candidates = [
    `src/${relative}.ts`,
    `src/${relative}.tsx`,
    `src/${relative}/index.ts`,
    `src/${relative}/index.tsx`,
  ];

  for (const candidate of candidates) {
    const absolute = path.join(projectRoot, candidate);
    if (!existsSync(absolute)) {
      continue;
    }
    // `format: "module-typescript"` yêu cầu Node tự strip type annotations.
    // `shortCircuit: true` để không gọi nextResolve với alias đã map.
    return {
      url: new URL(candidate, projectRootUrl).href,
      shortCircuit: true,
      format: "module-typescript",
    };
  }

  return nextResolve(specifier, context);
}
