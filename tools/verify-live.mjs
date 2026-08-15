import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const site = JSON.parse(await readFile(path.join(root, "contracts", "site.json"), "utf8"));
const routeContract = JSON.parse(await readFile(path.join(root, "contracts", "routes.lock.json"), "utf8"));
const baseFlag = process.argv.indexOf("--base");
const base = new URL(baseFlag >= 0 ? process.argv[baseFlag + 1] : site.canonicalUrl);
const shaFlag = process.argv.indexOf("--sha");
const expectedSha = shaFlag >= 0 ? process.argv[shaFlag + 1] : null;
const failures = [];

for (const route of routeContract.routes) {
  const url = new URL(route, base);
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) failures.push(`${url.href}: HTTP ${response.status}`);
    await response.arrayBuffer();
  } catch (error) {
    failures.push(`${url.href}: ${error.message}`);
  }
}

const homeResponse = await fetch(base, { redirect: "follow" });
const home = await homeResponse.text();
if (!home.includes("总想说点什么")) failures.push(`${base.href}: expected site title not found`);

if (expectedSha) {
  const metadataUrl = new URL("/dxh-build.json", base);
  const metadataResponse = await fetch(metadataUrl, { redirect: "follow" });
  if (!metadataResponse.ok) {
    failures.push(`${metadataUrl.href}: HTTP ${metadataResponse.status}`);
  } else {
    try {
      const metadata = await metadataResponse.json();
      if (metadata.sourceSha !== expectedSha) failures.push(`live source SHA ${metadata.sourceSha}, expected ${expectedSha}`);
    } catch (error) {
      failures.push(`${metadataUrl.href}: invalid JSON (${error.message})`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Verified ${routeContract.routes.length} live routes at ${base.origin}.`);
