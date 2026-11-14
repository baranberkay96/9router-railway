import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  syncManagedKey, managedKeyActive, storedPasswordSet, NotReadyError, MANAGED_KEY_ID, MANAGED_KEY_NAME,
} from "../lib/database.mjs";

// Tables as created by 9Router v0.5.116 (src/lib/db/schema.js).
const SCHEMA = `
CREATE TABLE apiKeys (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT, machineId TEXT,
  isActive INTEGER DEFAULT 1, createdAt TEXT NOT NULL, accessRestricted INTEGER DEFAULT 0, accessAllow TEXT);
CREATE TABLE settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
`;
const KEY_A = "sk-" + "a".repeat(40);
const KEY_B = "sk-" + "b".repeat(40);

let dbPath;
beforeEach(() => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "9r-test-")), "data.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  db.close();
});

const rows = () => {
  const db = new DatabaseSync(dbPath);
  try {
    return db.prepare("SELECT * FROM apiKeys ORDER BY id").all();
  } finally {
    db.close();
  }
};

test("missing database or table is NotReady", async () => {
  await assert.rejects(syncManagedKey(path.join(path.dirname(dbPath), "none.sqlite"), KEY_A), NotReadyError);
  const empty = path.join(path.dirname(dbPath), "empty.sqlite");
  new DatabaseSync(empty).close();
  await assert.rejects(syncManagedKey(empty, KEY_A), NotReadyError);
});

test("insert, unchanged, update, remove, absent", async () => {
  assert.equal(await syncManagedKey(dbPath, KEY_A, new Date("2026-11-14T00:00:00Z")), "inserted");
  const [row] = rows();
  assert.equal(row.id, MANAGED_KEY_ID);
  assert.equal(row.key, KEY_A);
  assert.equal(row.name, MANAGED_KEY_NAME);
  assert.equal(row.isActive, 1);
  assert.equal(row.accessRestricted, 0);
  assert.equal(row.accessAllow, "[]");
  assert.equal(row.createdAt, "2026-11-14T00:00:00.000Z");
  assert.equal(await syncManagedKey(dbPath, KEY_A), "unchanged");
  assert.equal(await syncManagedKey(dbPath, KEY_B), "updated");
  assert.equal(rows()[0].key, KEY_B);
  assert.equal(await syncManagedKey(dbPath, null), "removed");
  assert.equal(rows().length, 0);
  assert.equal(await syncManagedKey(dbPath, null), "absent");
});

test("a key switched off in the dashboard stays off after an update", async () => {
  await syncManagedKey(dbPath, KEY_A);
  const db = new DatabaseSync(dbPath);
  db.prepare("UPDATE apiKeys SET isActive = 0 WHERE id = ?").run(MANAGED_KEY_ID);
  db.close();
  assert.equal(await managedKeyActive(dbPath), false);
  assert.equal(await syncManagedKey(dbPath, KEY_B), "updated");
  assert.equal(rows()[0].isActive, 0);
});

test("a dashboard key with the same value is left alone", async () => {
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO apiKeys(id, key, name, createdAt) VALUES('user-key', ?, 'mine', 'now')").run(KEY_A);
  db.close();
  assert.equal(await syncManagedKey(dbPath, KEY_A), "duplicate");
  assert.equal(rows().length, 1);
});

test("dashboard keys are never touched", async () => {
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO apiKeys(id, key, name, createdAt) VALUES('user-key', ?, 'mine', 'now')").run(KEY_B);
  db.close();
  await syncManagedKey(dbPath, KEY_A);
  await syncManagedKey(dbPath, null);
  assert.deepEqual(rows().map((r) => r.id), ["user-key"]);
});

test("works on an older apiKeys table without access columns", async () => {
  const db = new DatabaseSync(dbPath);
  db.exec("DROP TABLE apiKeys; CREATE TABLE apiKeys (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT, machineId TEXT, isActive INTEGER DEFAULT 1, createdAt TEXT NOT NULL)");
  db.close();
  assert.equal(await syncManagedKey(dbPath, KEY_A), "inserted");
  assert.equal(await managedKeyActive(dbPath), true);
});

test("stored password detection", async () => {
  assert.equal(await storedPasswordSet(path.join(path.dirname(dbPath), "none.sqlite")), null);
  assert.equal(await storedPasswordSet(dbPath), false);
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO settings(id, data) VALUES(1, ?)").run(JSON.stringify({ requireLogin: true }));
  db.close();
  assert.equal(await storedPasswordSet(dbPath), false);
  const db2 = new DatabaseSync(dbPath);
  db2.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify({ password: "$2a$10$hash" }));
  db2.close();
  assert.equal(await storedPasswordSet(dbPath), true);
});
