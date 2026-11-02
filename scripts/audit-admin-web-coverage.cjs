const fs = require("fs");
const path = require("path");

/**
 * Audits the admin API parity between the backend and the web app.
 *
 * Two checks:
 *
 * 1. **API layer** — every backend admin route must be reachable from the
 *    web API layer (`lib/api/admin.ts` for reads, `lib/api/admin-commands.ts`
 *    for writes). Some routes are covered by a PARAMETERIZED wrapper, so a
 *    static route may match a `${...}` segment in the frontend.
 * 2. **UI layer** — every mutation wrapper in `admin-commands.ts` must be
 *    called by a Server Action, and every Server Action must be rendered by
 *    a client component. A wrapper with no UI is a command an admin cannot
 *    run.
 */

const root = process.cwd();
const base = path.join(root, "apps/api/app/api/v1/admin");

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name === "route.ts") acc.push(full);
  }
  return acc;
}

const routes = walk(base)
  .map((file) =>
    path.relative(base, file).replace(/[\\/]route\.ts$/, "").split(path.sep).join("/")
  )
  .sort();

const read = (file) => fs.readFileSync(path.resolve(root, file), "utf8");

const apiLayer =
  read("apps/web/src/lib/api/admin.ts") + "\n" + read("apps/web/src/lib/api/admin-commands.ts");

function escapeLiteral(segment) {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const missingApi = [];
for (const route of routes) {
  const parts = route.split("/").map((segment) => {
    if (segment.startsWith("[")) return "(?:[^/\"'`]+|\\$\\{[^}]*\\})";
    // A static backend segment may still be produced by a parameterized
    // frontend wrapper (e.g. `dashboard/${view}` covers `dashboard/summary`).
    return `(?:${escapeLiteral(segment)}|\\$\\{[^}]*\\})`;
  });
  if (!new RegExp("/api/v1/admin/" + parts.join("/")).test(apiLayer)) {
    missingApi.push(route);
  }
}

/* --------------------------------------------------------------------------
 * UI layer: every exported mutation wrapper must be reachable from a Server
 * Action, and every Server Action must be reachable from a component.
 * ----------------------------------------------------------------------- */

const commandsSource = read("apps/web/src/lib/api/admin-commands.ts");
const commandNames = [...commandsSource.matchAll(/^export function (admin\w+)/gm)].map(
  (match) => match[1]
);

const readsSource = read("apps/web/src/lib/api/admin.ts");
const readNames = [...readsSource.matchAll(/^export function (fetch\w+)/gm)].map(
  (match) => match[1]
);

const webSrcDir = path.join(root, "apps/web/src");
function walkSrc(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const srcFiles = walkSrc(webSrcDir);
const actionFiles = srcFiles.filter((file) => file.endsWith("actions.ts"));
const componentFiles = srcFiles.filter(
  (file) => file.endsWith(".tsx") && !file.endsWith("actions.ts")
);

const actionSources = actionFiles.map((file) => ({ file, source: read(file) }));
const componentSources = componentFiles.map((file) => ({ file, source: read(file) }));

/** Every file that is allowed to call the API layer. */
const consumerSources = [...componentSources, ...actionSources];

const unusedCommands = commandNames.filter(
  (name) => !actionSources.some((entry) => entry.source.includes(name))
);

const unusedReads = readNames.filter(
  (name) => !consumerSources.some((entry) => entry.source.includes(name))
);

const actionNames = [];
for (const entry of actionSources) {
  for (const match of entry.source.matchAll(/^export async function (\w+Action)/gm)) {
    actionNames.push({ file: entry.file, name: match[1] });
  }
}

const unusedActions = actionNames.filter(
  (action) =>
    !componentSources.some((entry) => entry.source.includes(action.name))
);

console.log("=== API layer ===");
console.log("backend admin routes:", routes.length);
console.log("not reachable from web api layer:", missingApi.length);
for (const route of missingApi) console.log("  -", route);

console.log("");
console.log("=== UI layer ===");
console.log("read wrappers:", readNames.length);
console.log("read wrappers with no consumer:", unusedReads.length);
for (const name of unusedReads) console.log("  -", name);
console.log("mutation wrappers:", commandNames.length);
console.log("wrappers with no Server Action:", unusedCommands.length);
for (const name of unusedCommands) console.log("  -", name);
console.log("Server Actions:", actionNames.length);
console.log("Actions never rendered by a component:", unusedActions.length);
for (const action of unusedActions) {
  console.log("  -", action.name, `(${path.relative(root, action.file)})`);
}
