import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const destination = "out/third-party";
await mkdir(destination, { recursive: true });
const packages = [
  ["replicad", path.resolve(path.dirname(require.resolve("replicad")), "..")],
  ["replicad-opencascadejs", path.dirname(require.resolve("replicad-opencascadejs/package.json"))],
];
for (const [name, directory] of packages) {
  await copyFile(path.join(directory, "LICENSE"), path.join(destination, `${name}.txt`));
}
