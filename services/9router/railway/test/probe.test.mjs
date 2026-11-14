import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { request, waitForHealth, remoteApiCheck, REMOTE_TEST_IP } from "../lib/probe.mjs";

const KEY = "sk-" + "k".repeat(40);

// Mimics 9Router's rule: loopback without forwarding headers is local and open;
// with X-Forwarded-For the request is remote and needs a valid key.
function fakeRouter() {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.headers);
    if (req.url === "/api/health") return res.writeHead(200).end("{}");
    if (req.url === "/v1/models") {
      const remote = Boolean(req.headers["x-forwarded-for"]);
      const ok = !remote || req.headers.authorization === `Bearer ${KEY}`;
      return res.writeHead(ok ? 200 : 401).end();
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, seen })));
}

test("remote check sends a forwarded header and reports both statuses", async () => {
  const { server, port, seen } = await fakeRouter();
  try {
    assert.deepEqual(await remoteApiCheck(port, KEY), { withoutKey: 401, withKey: 200 });
    assert.deepEqual(await remoteApiCheck(port, null), { withoutKey: 401, withKey: null });
    assert.ok(seen.every((h) => h["x-forwarded-for"] === REMOTE_TEST_IP));
  } finally {
    server.close();
  }
});

test("waitForHealth succeeds on 200 and gives up when the process is gone", async () => {
  const { server, port } = await fakeRouter();
  try {
    assert.equal(await waitForHealth(port, { timeoutMs: 2000, intervalMs: 50 }), true);
  } finally {
    server.close();
  }
  assert.equal(await waitForHealth(port, { timeoutMs: 5000, intervalMs: 50, isAlive: () => false }), false);
  assert.equal(await request(port, "/api/health", { timeoutMs: 500 }), 0);
});
