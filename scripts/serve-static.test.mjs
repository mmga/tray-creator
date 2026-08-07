import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createStaticServer } from "./serve-static.mjs";

async function withServer(run) {
  const root = await mkdtemp(path.join(tmpdir(), "tray-creator-static-"));
  await mkdir(path.join(root, "_next", "static"), { recursive: true });
  await writeFile(path.join(root, "index.html"), "<h1>首页</h1>");
  await writeFile(path.join(root, "404.html"), "<h1>未找到</h1>");
  await writeFile(path.join(root, "_next", "static", "app.js"), "export {};\n");
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

function request(url) {
  return fetch(url, { headers: { Connection: "close" } });
}

test("serves exported pages and immutable Next assets", async () => {
  await withServer(async (origin) => {
    const page = await request(`${origin}/`);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), "<h1>首页</h1>");

    const asset = await request(`${origin}/_next/static/app.js`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(
      asset.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
  });
});

test("returns the exported 404 page without leaking files above the root", async () => {
  await withServer(async (origin) => {
    const missing = await request(`${origin}/missing`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "<h1>未找到</h1>");

    const traversal = await request(`${origin}/%2e%2e/%2e%2e/package.json`);
    assert.equal(traversal.status, 404);
    assert.equal(await traversal.text(), "<h1>未找到</h1>");
  });
});
