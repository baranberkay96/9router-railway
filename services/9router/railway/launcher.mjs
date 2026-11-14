// Railway launcher for 9Router: checks the deploy-form values, starts 9Router's
// own custom-server.js (which keeps its X-Forwarded-For handling), then syncs
// the managed API key and logs a remote-access self-check. It never exits
// because of a variable value; it exits only when 9Router exits.
import { spawn } from "node:child_process";
import path from "node:path";
import { resolveConfig, buildChildEnv, DATA_DIR } from "./lib/config.mjs";
import { syncManagedKey, managedKeyActive, storedPasswordSet, NotReadyError } from "./lib/database.mjs";
import { request, waitForHealth, remoteApiCheck } from "./lib/probe.mjs";

const APP_DIR = "/app";
const DB_FILE = path.join(DATA_DIR, "db", "data.sqlite");
const log = (message) => console.log(`[railway] ${message}`);
const warn = (message) => console.warn(`[railway] WARNING: ${message}`);

const config = resolveConfig(process.env);
config.warnings.forEach(warn);
if (!process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  warn(`no Railway volume is attached; providers, keys and settings in ${DATA_DIR} are lost on every redeploy.`);
} else if (path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) !== DATA_DIR) {
  warn(`the volume is mounted at ${process.env.RAILWAY_VOLUME_MOUNT_PATH}, but 9Router stores its data in ${DATA_DIR}; move the volume to ${DATA_DIR}.`);
}

const passwordStored = await storedPasswordSet(DB_FILE);
if (passwordStored) {
  log("a dashboard password is set; INITIAL_PASSWORD is not used for login.");
} else if (!config.passwordLocked) {
  log("dashboard login: the password in the INITIAL_PASSWORD variable.");
}

let stopping = false;
const child = spawn(process.execPath, ["custom-server.js"], {
  cwd: APP_DIR,
  env: buildChildEnv(process.env, config),
  stdio: "inherit",
});
let alive = true;

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    if (alive) child.kill(signal);
  });
}
child.on("exit", (code, signal) => {
  alive = false;
  if (!stopping) warn(`9Router exited (${signal || `code ${code}`}); Railway restarts the service.`);
  process.exit(stopping ? 0 : code || 1);
});
child.on("error", (error) => {
  alive = false;
  warn(`could not start 9Router: ${error.message}`);
  process.exit(1);
});

async function syncKeyWithRetry() {
  for (let attempt = 1; attempt <= 90 && alive; attempt += 1) {
    try {
      return await syncManagedKey(DB_FILE, config.apiKey);
    } catch (error) {
      if (!(error instanceof NotReadyError)) throw error;
      await request(config.port, "/api/settings/require-login"); // makes 9Router open and migrate its database
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("9Router's database did not become ready within 3 minutes");
}

async function afterStart() {
  if (!(await waitForHealth(config.port, { isAlive: () => alive }))) return;
  log(`9Router is up on port ${config.port}.`);
  try {
    const result = await syncKeyWithRetry();
    const messages = {
      inserted: "managed API key from NINEROUTER_API_KEY added.",
      updated: "managed API key updated to the current NINEROUTER_API_KEY.",
      unchanged: "managed API key matches NINEROUTER_API_KEY.",
      removed: "managed API key removed.",
      absent: "no managed API key.",
      duplicate: "NINEROUTER_API_KEY already exists as a dashboard key; nothing to add.",
    };
    log(messages[result]);
  } catch (error) {
    warn(`could not sync the managed API key: ${error.message}. Create keys in the dashboard instead.`);
  }
  const active = config.apiKey ? await managedKeyActive(DB_FILE).catch(() => false) : false;
  const { withoutKey, withKey } = await remoteApiCheck(config.port, active ? config.apiKey : null);
  if (withoutKey === 401) log("self-check: remote /v1/models without an API key -> 401 (protected).");
  else warn(`self-check: remote /v1/models without an API key returned ${withoutKey}, expected 401.`);
  if (withKey !== null) {
    if (withKey === 200) log("self-check: remote /v1/models with NINEROUTER_API_KEY -> 200.");
    else warn(`self-check: remote /v1/models with NINEROUTER_API_KEY returned ${withKey}, expected 200.`);
  } else if (config.apiKey) {
    log("the managed API key is switched off in the dashboard; skipped the keyed check.");
  }
}

afterStart().catch((error) => warn(`post-start checks failed: ${error.message}`));
