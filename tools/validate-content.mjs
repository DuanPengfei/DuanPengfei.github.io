import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const postsDirectory = path.join(process.cwd(), "source", "_posts");
const postFiles = (await readdir(postsDirectory))
  .filter((name) => name.endsWith(".md"))
  .sort((left, right) => left.localeCompare(right, "zh-CN"));
const seenNames = new Set();
const failures = [];

for (const file of postFiles) {
  const normalizedName = file.normalize("NFC").toLocaleLowerCase("en-US");
  if (seenNames.has(normalizedName)) {
    failures.push(`${file}: duplicate normalized filename`);
  }
  seenNames.add(normalizedName);

  const content = await readFile(path.join(postsDirectory, file), "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatter) {
    failures.push(`${file}: missing YAML frontmatter`);
    continue;
  }
  if (!/^title:\s*\S.+$/m.test(frontmatter[1])) {
    failures.push(`${file}: missing title`);
  }
  if (!/^date:\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?\s*$/m.test(frontmatter[1])) {
    failures.push(`${file}: missing or invalid date`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated ${postFiles.length} source posts.`);
