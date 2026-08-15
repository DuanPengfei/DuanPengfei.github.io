import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "public");

await mkdir(output, { recursive: true });
await copyFile(
  path.join(root, "contracts", "legacy-public-agents.txt"),
  path.join(output, "AGENTS.md"),
);
