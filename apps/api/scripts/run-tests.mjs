/* global console, process */

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vitestEntry = path.join(root, "node_modules", "vitest", "vitest.mjs");
const dbTestPatterns = [
  ...findIntegrationTests(path.join(root, "src")),
  "src/features/outbox/__tests__/worker-nonblocking.smoke.test.ts"
];

const mode = process.argv[2] ?? "unit";
const passthrough = process.argv.slice(3);

if (!["unit", "db", "full"].includes(mode)) {
  console.error(`Unknown test mode: ${mode}`);
  process.exit(1);
}

const exitCode =
  mode === "full"
    ? await runFull(passthrough)
    : await runVitest({
        db: mode === "db",
        passthrough
      });

process.exit(exitCode);

async function runFull(extraArgs) {
  const unitCode = await runVitest({ db: false, passthrough: extraArgs });
  if (unitCode !== 0) {
    return unitCode;
  }

  return runVitest({ db: true, passthrough: extraArgs });
}

function runVitest({ db, passthrough }) {
  const watch = passthrough.includes("--watch") || passthrough.includes("-w");
  const filteredArgs = passthrough.filter((arg) => arg !== "--watch" && arg !== "-w");
  const hasExplicitPattern = hasExplicitTestPattern(filteredArgs);
  const args = [
    vitestEntry,
    ...(watch ? [] : ["run"]),
    ...(db && !hasExplicitPattern ? dbTestPatterns : []),
    ...filteredArgs
  ];
  const env = {
    ...process.env,
    RUN_DB_TESTS: db ? "true" : "false"
  };

  console.log(db ? "Running DB integration tests..." : "Running unit tests...");

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: "inherit"
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
  });
}

function hasExplicitTestPattern(args) {
  const optionsWithValues = new Set([
    "--config",
    "--dir",
    "--environment",
    "--outputFile",
    "--pool",
    "--project",
    "--reporter",
    "--root",
    "--testNamePattern",
    "-c",
    "-t"
  ]);
  let skipOptionValue = false;

  for (const arg of args) {
    if (skipOptionValue) {
      skipOptionValue = false;
      continue;
    }
    if (optionsWithValues.has(arg)) {
      skipOptionValue = true;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    return true;
  }

  return false;
}

function findIntegrationTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return findIntegrationTests(absolute);
    if (!entry.name.endsWith(".integration.test.ts")) return [];
    return [path.relative(root, absolute).split(path.sep).join("/")];
  });
}
