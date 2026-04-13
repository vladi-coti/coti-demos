import fs from "node:fs/promises";
import path from "node:path";

export function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export function normalizeAddress(value, key) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${key}: ${value}`);
  }
  return value;
}

export async function appendDeploymentLog(entry) {
  const logPath = path.resolve(process.cwd(), "deployment.log");
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, "utf8");
}
