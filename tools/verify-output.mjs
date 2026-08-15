import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDirectory = path.join(root, "public");
const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const site = await readJson("contracts/site.json");
const routeContract = await readJson("contracts/routes.lock.json");
const assetContract = await readJson("contracts/critical-assets.lock.json");
const failures = [];

function routeFile(route) {
  if (!route.startsWith("/") || route.includes("..")) {
    throw new Error(`Unsafe locked route: ${route}`);
  }
  if (route === "/") return path.join(publicDirectory, "index.html");
  const relative = route.slice(1);
  return path.join(publicDirectory, route.endsWith("/") ? relative : "", route.endsWith("/") ? "index.html" : relative);
}

for (const route of routeContract.routes) {
  try {
    await access(routeFile(route));
  } catch {
    failures.push(`missing locked route: ${route}`);
  }
}

const cname = (await readFile(path.join(publicDirectory, "CNAME"), "utf8")).trim();
if (cname !== site.cname) failures.push(`CNAME is ${JSON.stringify(cname)}, expected ${site.cname}`);

const config = await readFile(path.join(root, "_config.yml"), "utf8");
if (!config.includes(`url: ${site.canonicalUrl}`)) failures.push("_config.yml canonical URL drifted");
if (!/^root:\s*\/\s*$/m.test(config)) failures.push("_config.yml root must remain /");
if (!config.includes(`timezone: '${site.timezone}'`)) failures.push("_config.yml timezone drifted");

for (const [relativePath, expectedHash] of Object.entries(assetContract.sha256)) {
  const body = await readFile(path.join(publicDirectory, relativePath));
  const actualHash = createHash("sha256").update(body).digest("hex");
  if (actualHash !== expectedHash) failures.push(`${relativePath}: sha256 ${actualHash}, expected ${expectedHash}`);
}

const posts = (await readdir(path.join(root, "source", "_posts"))).filter((name) => name.endsWith(".md"));
if (posts.length < site.minimumPostCount) failures.push(`source post count ${posts.length} is below ${site.minimumPostCount}`);

const buildMeta = JSON.parse(await readFile(path.join(publicDirectory, ".well-known", "dxh-build.json"), "utf8"));
if (!/^[0-9a-f]{40}$/.test(buildMeta.sourceSha)) failures.push("build metadata has an invalid source SHA");
if (process.env.GITHUB_SHA && buildMeta.sourceSha !== process.env.GITHUB_SHA) failures.push("build metadata does not match GITHUB_SHA");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Verified ${routeContract.routes.length} locked routes, ${Object.keys(assetContract.sha256).length} critical files, ${posts.length} posts, and build ${buildMeta.sourceSha}.`);
