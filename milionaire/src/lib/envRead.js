/**
 * Read Vite client env. See envPrefix in vite.config.js (VITE_, SEPOLIA_, COTI_, ENC_).
 */
export function readEnv(key, fallback) {
    const v = import.meta.env[key];
    if (v !== undefined && v !== null && v !== '') {
        return v;
    }
    return fallback;
}
