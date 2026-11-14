// Loopback HTTP probes against 9Router. A request carrying X-Forwarded-For is
// treated by 9Router's custom-server.js as coming through a proxy, i.e. as a
// remote client, so it gets exactly the checks a request from the internet gets.
import http from "node:http";

// TEST-NET-3 documentation address (RFC 5737): never a real client.
export const REMOTE_TEST_IP = "203.0.113.10";

export function request(port, path, { headers = {}, timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path, headers, timeout: timeoutMs }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve(0));
  });
}

export async function waitForHealth(port, { timeoutMs = 600_000, intervalMs = 2000, isAlive = () => true } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && isAlive()) {
    if ((await request(port, "/api/health")) === 200) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// Status codes for /v1/models as a remote client: without a key, with the managed key.
export async function remoteApiCheck(port, apiKey) {
  const remote = { "X-Forwarded-For": REMOTE_TEST_IP, "X-Forwarded-Proto": "https" };
  const withoutKey = await request(port, "/v1/models", { headers: remote });
  const withKey = apiKey
    ? await request(port, "/v1/models", { headers: { ...remote, Authorization: `Bearer ${apiKey}` } })
    : null;
  return { withoutKey, withKey };
}
