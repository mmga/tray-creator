import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const staticRoot = path.resolve("out", "_next", "static");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

const files = await collectFiles(staticRoot);
const rawTypeScriptAssets = files.filter((file) => file.endsWith(".ts"));
if (rawTypeScriptAssets.length > 0) {
  throw new Error(
    `构建产物包含未编译的 TypeScript Worker：${rawTypeScriptAssets.join(", ")}`,
  );
}

const javaScriptFiles = files.filter((file) => file.endsWith(".js"));
let workerBundle = null;
for (const file of javaScriptFiles) {
  const source = await readFile(file, "utf8");
  if (source.includes("self.onmessage") && source.includes("GENERATE_GRID")) {
    workerBundle = file;
    break;
  }
}

if (!workerBundle) {
  throw new Error("构建产物中未找到已编译的建模 Worker 入口");
}

console.log(`已验证建模 Worker bundle：${path.relative(process.cwd(), workerBundle)}`);
