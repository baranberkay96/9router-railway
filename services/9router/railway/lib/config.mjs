// Deploy-form values → a safe runtime configuration for 9Router.
// Nothing here throws or exits: an unusable value falls back to a default or
// fails closed (STANDARD rule 29), and the reason goes to the log.
import crypto from "node:crypto";

export const DEFAULT_PORT = 20128;
export const DATA_DIR = "/app/data";
export const HOME_DIR = `${DATA_DIR}/home`;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const JWT_SECRET_MIN = 32;
export const API_KEY_PATTERN = /^[A-Za-z0-9._~-]{32,200}$/;

// Variables this wrapper owns; 9Router never sees them.
const WRAPPER_ONLY = ["NINEROUTER_API_KEY", "NINEROUTER_PUBLIC_BASE_URL", "NINEROUTER_PRIVATE_BASE_URL"];

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function randomSecret(bytes = 36) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function resolvePort(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return { port: DEFAULT_PORT, warning: null };
  const port = Number(text);
  if (/^\d+$/.test(text) && port >= 1 && port <= 65535) return { port, warning: null };
  return { port: DEFAULT_PORT, warning: `PORT "${text.slice(0, 20)}" is not a port number; using ${DEFAULT_PORT}.` };
}

// INITIAL_PASSWORD is the dashboard password until one is set in the dashboard.
// Too short, too long or empty: lock the login with a random password nobody knows
// instead of exiting or falling back to upstream's public default (123456).
export function resolvePassword(raw) {
  const value = typeof raw === "string" ? raw : "";
  const problem =
    value === "" ? "is empty"
    : value.length < PASSWORD_MIN ? `is shorter than ${PASSWORD_MIN} characters`
    : value.length > PASSWORD_MAX ? `is longer than ${PASSWORD_MAX} characters`
    : CONTROL_CHARS.test(value) ? "contains control characters"
    : null;
  if (!problem) return { password: value, locked: false, warning: null };
  return {
    password: randomSecret(),
    locked: true,
    warning:
      `INITIAL_PASSWORD ${problem}. Password login is locked with a random password. ` +
      `Set INITIAL_PASSWORD to ${PASSWORD_MIN}-${PASSWORD_MAX} characters and redeploy ` +
      `(it only applies until you set a password in the dashboard).`,
  };
}

// Too short or missing: let 9Router use the secret it generates and keeps in DATA_DIR.
export function resolveJwtSecret(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length >= JWT_SECRET_MIN && value.length <= 512) return { secret: value, warning: null };
  if (value === "") return { secret: null, warning: null };
  return {
    secret: null,
    warning: `JWT_SECRET is not ${JWT_SECRET_MIN}-512 characters; 9Router uses the session secret stored in ${DATA_DIR}/jwt-secret instead.`,
  };
}

// The managed API key. Empty disables it; anything else that does not match
// the pattern also disables it (fail closed) and says why.
export function resolveApiKey(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return { key: null, warning: "NINEROUTER_API_KEY is empty; the managed API key is removed. Create keys in the dashboard." };
  if (API_KEY_PATTERN.test(value)) return { key: value, warning: null };
  return {
    key: null,
    warning: "NINEROUTER_API_KEY must be 32-200 characters of A-Z a-z 0-9 . _ ~ -; the managed API key is removed until it is fixed.",
  };
}

export function resolveConfig(env) {
  const port = resolvePort(env.PORT);
  const password = resolvePassword(env.INITIAL_PASSWORD);
  const jwt = resolveJwtSecret(env.JWT_SECRET);
  const apiKey = resolveApiKey(env.NINEROUTER_API_KEY);
  const warnings = [port.warning, password.warning, jwt.warning, apiKey.warning].filter(Boolean);
  return Object.freeze({
    port: port.port,
    password: password.password,
    passwordLocked: password.locked,
    jwtSecret: jwt.secret,
    apiKey: apiKey.key,
    warnings: Object.freeze(warnings),
  });
}

// The environment 9Router runs with. Returns a new object; `env` is not changed.
export function buildChildEnv(env, config) {
  const child = { ...env };
  for (const name of WRAPPER_ONLY) delete child[name];
  child.PORT = String(config.port);
  child.HOSTNAME = "::"; // dual-stack: Railway healthcheck (IPv4) and private network (IPv6)
  child.DATA_DIR = DATA_DIR;
  child.HOME = HOME_DIR;
  child.NODE_ENV = "production";
  child.NEXT_TELEMETRY_DISABLED = "1";
  child.INITIAL_PASSWORD = config.password;
  if (config.jwtSecret) child.JWT_SECRET = config.jwtSecret;
  else delete child.JWT_SECRET;
  return child;
}
