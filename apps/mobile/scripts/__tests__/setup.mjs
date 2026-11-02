/**
 * Entry point cho `node --test` ở apps/mobile.
 *
 * Đăng ký module resolve hook map alias `@/...` → `src/...`.
 *
 * Dùng: node --import ./scripts/__tests__/setup.mjs --test "<glob>"
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-hook.mjs", import.meta.url);
