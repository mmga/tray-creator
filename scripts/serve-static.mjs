import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

async function resolveFile(root, pathname) {
  const candidate = path.resolve(root, `.${pathname}`);
  const rootPrefix = `${root}${path.sep}`;
  if (candidate !== root && !candidate.startsWith(rootPrefix)) return null;

  try {
    const candidateStat = await stat(candidate);
    if (candidateStat.isDirectory()) {
      return path.join(candidate, "index.html");
    }
    if (candidateStat.isFile()) return candidate;
  } catch {
    if (!path.extname(candidate)) {
      const htmlCandidate = `${candidate}.html`;
      try {
        if ((await stat(htmlCandidate)).isFile()) return htmlCandidate;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function createStaticServer(rootDirectory) {
  const root = path.resolve(rootDirectory);
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    } catch {
      response.writeHead(400);
      response.end("Bad Request");
      return;
    }

    const requestedFile = await resolveFile(root, pathname);
    const file = requestedFile ?? await resolveFile(root, "/404.html");
    if (!file) {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }

    const headers = {
      "Content-Type": MIME_TYPES.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
      "Cache-Control": pathname.startsWith("/_next/static/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    };
    response.writeHead(requestedFile ? 200 : 404, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(file).on("error", () => response.destroy()).pipe(response);
  });
}

const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "0.0.0.0";
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`无效端口：${process.env.PORT}`);
  }
  const server = createStaticServer(path.resolve("out"));
  server.listen(port, host, () => {
    console.log(`静态生产站点已启动：http://${host}:${port}`);
  });
  const close = () => server.close(() => process.exit(0));
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
