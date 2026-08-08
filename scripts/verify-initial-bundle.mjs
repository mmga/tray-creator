import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const manifestPath = path.resolve(
  ".next",
  "server",
  "app",
  "page_client-reference-manifest.js",
);

await import(pathToFileURL(manifestPath).href);

const pageManifest = globalThis.__RSC_MANIFEST?.["/page"];
const pageModuleKey = Object.keys(pageManifest?.clientModules ?? {}).find(
  (key) => key.replaceAll("/", "\\").endsWith("src\\app\\page.tsx"),
);

if (!pageModuleKey) {
  throw new Error("无法从生产 manifest 定位首页客户端入口");
}

const initialChunks = pageManifest.clientModules[pageModuleKey].chunks.filter(
  (chunk) => typeof chunk === "string" && chunk.endsWith(".js"),
);
const forbiddenRuntimeSignatures = [
  {
    label: "Three.js",
    matches: (source) =>
      ["BufferGeometry", "WebGLRenderer"].some((value) =>
        source.includes(value),
      ),
  },
  {
    label: "JSCAD",
    matches: (source) =>
      source.includes("geom3") && source.includes("toPolygons"),
  },
];
const maxInitialJavaScriptBytes = 16 * 1024;
let initialJavaScriptBytes = 0;

for (const chunk of initialChunks) {
  const source = await readFile(path.resolve(".next", chunk), "utf8");
  initialJavaScriptBytes += Buffer.byteLength(source);
  const forbiddenRuntime = forbiddenRuntimeSignatures.find(({ matches }) =>
    matches(source),
  );
  if (forbiddenRuntime) {
    throw new Error(
      `首页同步 chunk ${chunk} 包含 ${forbiddenRuntime.label} 运行时签名`,
    );
  }
}

if (initialJavaScriptBytes > maxInitialJavaScriptBytes) {
  throw new Error(
    `首页直接 JavaScript 为 ${initialJavaScriptBytes} bytes，超过 ${maxInitialJavaScriptBytes} bytes 预算`,
  );
}

console.log(
  `已验证首页直接 JavaScript：${initialChunks.length} 个 chunk，${initialJavaScriptBytes} / ${maxInitialJavaScriptBytes} bytes，未同步加载 Three.js 或 JSCAD`,
);
