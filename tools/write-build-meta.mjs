import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceSha = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const outputDirectory = path.join(root, "public");

if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
  throw new Error(`Invalid source SHA: ${sourceSha}`);
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, "dxh-build.json"),
  `${JSON.stringify({ schemaVersion: 1, sourceSha })}\n`,
  "utf8",
);
