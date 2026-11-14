// Small, direct access to 9Router's SQLite database (DATA_DIR/db/data.sqlite)
// for the two things this wrapper needs: the managed API key row and whether a
// dashboard password has been stored. Schema checked against 9Router v0.5.116
// (src/lib/db/schema.js: apiKeys, settings). 9Router keeps the file in WAL
// mode and looks keys up per request (validateApiKey), so a row written here
// is valid at once.
import fs from "node:fs";

export const MANAGED_KEY_ID = "railway-managed-key";
export const MANAGED_KEY_NAME = "Railway (NINEROUTER_API_KEY)";

export class NotReadyError extends Error {}

let sqliteModule = null;
async function sqlite() {
  if (!sqliteModule) {
    // node:sqlite prints an ExperimentalWarning on Node 22; it is stable enough
    // that 9Router itself falls back to it.
    const originalEmit = process.emitWarning;
    process.emitWarning = (warning, ...rest) => {
      if (String(warning).includes("SQLite")) return;
      return originalEmit.call(process, warning, ...rest);
    };
    try {
      sqliteModule = await import("node:sqlite");
    } finally {
      process.emitWarning = originalEmit;
    }
  }
  return sqliteModule;
}

async function open(dbPath, { readOnly = false } = {}) {
  if (!fs.existsSync(dbPath)) throw new NotReadyError(`database ${dbPath} does not exist yet`);
  const { DatabaseSync } = await sqlite();
  const db = new DatabaseSync(dbPath, { readOnly });
  db.exec("PRAGMA busy_timeout = 10000");
  return db;
}

function hasTable(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function columns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

// Make the managed key row match `key`. `key === null` removes it.
// Returns "inserted" | "updated" | "unchanged" | "removed" | "absent" | "duplicate".
export async function syncManagedKey(dbPath, key, now = new Date()) {
  const db = await open(dbPath);
  try {
    if (!hasTable(db, "apiKeys")) throw new NotReadyError("table apiKeys does not exist yet");
    const existing = db.prepare("SELECT key FROM apiKeys WHERE id = ?").get(MANAGED_KEY_ID);
    if (key === null) {
      if (!existing) return "absent";
      db.prepare("DELETE FROM apiKeys WHERE id = ?").run(MANAGED_KEY_ID);
      return "removed";
    }
    if (existing && existing.key === key) return "unchanged";
    const other = db.prepare("SELECT id FROM apiKeys WHERE key = ? AND id <> ?").get(key, MANAGED_KEY_ID);
    if (other) return "duplicate";
    if (existing) {
      // Keep isActive as it is: a key switched off in the dashboard stays off.
      db.prepare("UPDATE apiKeys SET key = ? WHERE id = ?").run(key, MANAGED_KEY_ID);
      return "updated";
    }
    const cols = columns(db, "apiKeys");
    const row = { id: MANAGED_KEY_ID, key, name: MANAGED_KEY_NAME, machineId: null, isActive: 1, createdAt: now.toISOString() };
    if (cols.has("accessRestricted")) row.accessRestricted = 0;
    if (cols.has("accessAllow")) row.accessAllow = "[]";
    const names = Object.keys(row);
    db.prepare(`INSERT INTO apiKeys(${names.join(", ")}) VALUES(${names.map(() => "?").join(", ")})`).run(...Object.values(row));
    return "inserted";
  } finally {
    db.close();
  }
}

// Whether the managed key row is active (false if it is missing or switched off).
export async function managedKeyActive(dbPath) {
  const db = await open(dbPath, { readOnly: true });
  try {
    if (!hasTable(db, "apiKeys")) return false;
    const row = db.prepare("SELECT isActive FROM apiKeys WHERE id = ?").get(MANAGED_KEY_ID);
    return Boolean(row && Number(row.isActive) === 1);
  } finally {
    db.close();
  }
}

// true: a dashboard password hash is stored, so INITIAL_PASSWORD no longer applies.
// null: unknown (no database yet, or unreadable).
export async function storedPasswordSet(dbPath) {
  let db;
  try {
    db = await open(dbPath, { readOnly: true });
    if (!hasTable(db, "settings")) return null;
    const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
    if (!row) return false;
    const data = JSON.parse(row.data || "{}");
    return typeof data.password === "string" && data.password.length > 0;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
