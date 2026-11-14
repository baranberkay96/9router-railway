import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePort, resolvePassword, resolveJwtSecret, resolveApiKey, resolveConfig, buildChildEnv,
  DEFAULT_PORT, DATA_DIR, HOME_DIR,
} from "../lib/config.mjs";

test("port: valid values are kept, anything else falls back with a warning", () => {
  assert.deepEqual(resolvePort("8080"), { port: 8080, warning: null });
  assert.deepEqual(resolvePort(""), { port: DEFAULT_PORT, warning: null });
  assert.deepEqual(resolvePort(undefined), { port: DEFAULT_PORT, warning: null });
  for (const bad of ["0", "65536", "80a", "-1", "1.5"]) {
    const result = resolvePort(bad);
    assert.equal(result.port, DEFAULT_PORT, bad);
    assert.match(result.warning, /not a port number/);
  }
});

test("password: 12-128 characters are used as given", () => {
  const value = "correct horse battery";
  assert.deepEqual(resolvePassword(value), { password: value, locked: false, warning: null });
  assert.equal(resolvePassword("x".repeat(128)).locked, false);
});

test("password: empty, short, long or control characters lock the login", () => {
  for (const bad of [undefined, "", "123456", "x".repeat(11), "x".repeat(129), "abcdefghijkl\n"]) {
    const result = resolvePassword(bad);
    assert.equal(result.locked, true, JSON.stringify(bad));
    assert.ok(result.password.length >= 40);
    assert.notEqual(result.password, "123456");
    assert.match(result.warning, /locked/);
  }
  assert.notEqual(resolvePassword("").password, resolvePassword("").password);
});

test("password warning never contains the rejected value", () => {
  const result = resolvePassword("short-pw");
  assert.ok(!result.warning.includes("short-pw"));
});

test("jwt secret: long values kept, short ones dropped with a warning, empty silently", () => {
  const good = "a".repeat(64);
  assert.deepEqual(resolveJwtSecret(good), { secret: good, warning: null });
  assert.deepEqual(resolveJwtSecret(""), { secret: null, warning: null });
  const short = resolveJwtSecret("tooshort");
  assert.equal(short.secret, null);
  assert.match(short.warning, /jwt-secret/);
});

test("api key: pattern enforced, failures disable the managed key", () => {
  const good = "sk-" + "A1b2C3d4".repeat(6);
  assert.deepEqual(resolveApiKey(good), { key: good, warning: null });
  assert.deepEqual(resolveApiKey(`  ${good}  `), { key: good, warning: null });
  for (const bad of ["", "short", "sk-has space in it and is long enough!!", "x".repeat(201)]) {
    const result = resolveApiKey(bad);
    assert.equal(result.key, null, bad);
    assert.ok(result.warning);
    if (bad) assert.ok(!result.warning.includes(bad));
  }
});

test("resolveConfig collects warnings and freezes the result", () => {
  const config = resolveConfig({ PORT: "abc", INITIAL_PASSWORD: "", JWT_SECRET: "", NINEROUTER_API_KEY: "" });
  assert.equal(config.port, DEFAULT_PORT);
  assert.equal(config.passwordLocked, true);
  assert.equal(config.warnings.length, 3);
  assert.ok(Object.isFrozen(config));
});

test("child env: wrapper variables removed, runtime fixed, input not mutated", () => {
  const env = Object.freeze({
    PATH: "/usr/bin", PORT: "1", NINEROUTER_API_KEY: "secret-key", NINEROUTER_PUBLIC_BASE_URL: "x",
    NINEROUTER_PRIVATE_BASE_URL: "y", JWT_SECRET: "short", DATA_DIR: "/elsewhere", HOSTNAME: "abc",
  });
  const config = resolveConfig({ PORT: "20128", INITIAL_PASSWORD: "a-good-password", JWT_SECRET: "short", NINEROUTER_API_KEY: "" });
  const child = buildChildEnv(env, config);
  assert.equal(child.NINEROUTER_API_KEY, undefined);
  assert.equal(child.NINEROUTER_PUBLIC_BASE_URL, undefined);
  assert.equal(child.NINEROUTER_PRIVATE_BASE_URL, undefined);
  assert.equal(child.JWT_SECRET, undefined);
  assert.equal(child.PORT, "20128");
  assert.equal(child.HOSTNAME, "::");
  assert.equal(child.DATA_DIR, DATA_DIR);
  assert.equal(child.HOME, HOME_DIR);
  assert.equal(child.INITIAL_PASSWORD, "a-good-password");
  assert.equal(child.PATH, "/usr/bin");
  assert.equal(env.PORT, "1");
});

test("child env keeps a valid JWT secret", () => {
  const secret = "s".repeat(48);
  const config = resolveConfig({ INITIAL_PASSWORD: "a-good-password", JWT_SECRET: secret });
  assert.equal(buildChildEnv({}, config).JWT_SECRET, secret);
});
