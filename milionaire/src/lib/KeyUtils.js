/**
 * Light obfuscation for private keys in env (browser + Node).
 * AES-256-GCM with key = SHA-256(ENC_K); random IV per encryption. Not for high-threat models.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

const V2_PREFIX = 'v2:';
const V1_PREFIX = 'v1:';
const IV_LEN = 12;
const TAG_LEN = 16;

function randomBytes(n) {
    const u = new Uint8Array(n);
    if (typeof globalThis.crypto?.getRandomValues !== 'function') {
        throw new Error('crypto.getRandomValues is not available');
    }
    globalThis.crypto.getRandomValues(u);
    return u;
}

function concatBytes(...parts) {
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) {
        out.set(p, o);
        o += p.length;
    }
    return out;
}

/** 32-byte AES key from ENC_K (UTF-8). */
function deriveKey(encK) {
    return sha256(new TextEncoder().encode(encK.trim()));
}

/** Decode hex private key bytes; accepts optional `0x` prefix. */
export function parsePrivateKeyHex(hex) {
    const t = hex.trim().replace(/^0x/i, '');
    if (t.length === 0 || t.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(t)) {
        throw new Error('Invalid hex private key: expected even-length hex (optional 0x prefix)');
    }
    return hexToBytes(t);
}

/** Normalize decrypted key bytes to lowercase hex with `0x` prefix. */
export function formatPrivateKeyHex(keyBytes) {
    return '0x' + bytesToHex(keyBytes);
}

/**
 * Encrypt a private key (hex, optional `0x`). Returns `v2:` + hex(iv ∥ tag ∥ ciphertext).
 * @param {string} plainPrivateKeyHex
 * @param {string} encK
 * @returns {string}
 */
export function encryptPrivateKey(plainPrivateKeyHex, encK) {
    const trimmed = encK.trim();
    if (!trimmed) {
        throw new Error('ENC_K is empty: set a passphrase in the environment');
    }
    const key = deriveKey(trimmed);
    const plaintext = parsePrivateKeyHex(plainPrivateKeyHex);
    const iv = randomBytes(IV_LEN);
    const sealed = gcm(key, iv).encrypt(plaintext);
    const enc = sealed.slice(0, sealed.length - TAG_LEN);
    const tag = sealed.slice(-TAG_LEN);
    const payload = concatBytes(iv, tag, enc);
    return V2_PREFIX + bytesToHex(payload);
}

/**
 * Decrypt a `v2:` value from {@link encryptPrivateKey}.
 * @param {string} encryptedBlob
 * @param {string} encK
 * @returns {string}
 */
export function decryptPrivateKey(encryptedBlob, encK) {
    const blob = encryptedBlob.trim();
    if (!blob.startsWith(V2_PREFIX)) {
        throw new Error('Invalid encrypted key format (expected v2:...)');
    }
    const trimmed = encK.trim();
    if (!trimmed) {
        throw new Error('ENC_K is empty: cannot decrypt private key');
    }
    const hexPart = blob.slice(V2_PREFIX.length).replace(/^0x/i, '');
    if (hexPart.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hexPart)) {
        throw new Error('Invalid encrypted key: payload is not valid hex');
    }
    const raw = hexToBytes(hexPart);
    const minLen = IV_LEN + TAG_LEN + 1;
    if (raw.length < minLen) {
        throw new Error('Encrypted key payload is truncated');
    }
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = raw.subarray(IV_LEN + TAG_LEN);
    const key = deriveKey(trimmed);
    const combined = concatBytes(enc, tag);
    const plain = gcm(key, iv).decrypt(combined);
    return formatPrivateKeyHex(plain);
}

/** @typedef {(name: string) => string | undefined} EnvGetter */

const defaultNodeEnvGetter = (name) =>
    typeof process !== 'undefined' && process.env ? process.env[name] : undefined;

/**
 * @param {string} trimmed
 * @param {EnvGetter} getEnv
 * @param {string} [envVarName]
 */
function interpretPrivateKeyBlob(trimmed, getEnv, envVarName = 'PRIVATE_KEY') {
    // Copy/paste or tooling sometimes prefixes `0x` to `v2:` blobs; ethers then rejects BytesLike.
    if (/^0xv2:/i.test(trimmed)) {
        trimmed = trimmed.slice(2);
    }
    if (trimmed.startsWith(V1_PREFIX)) {
        throw new Error(
            `Private key in ${envVarName} uses old v1: format. Run ENC_K='...' npm run encrypt-key -- '0x…' and replace the value with the new v2: output.`
        );
    }
    if (trimmed.startsWith(V2_PREFIX)) {
        const encK = getEnv('ENC_K');
        if (encK === undefined || encK.trim() === '') {
            throw new Error('ENC_K must be set to decrypt v2: private keys');
        }
        return decryptPrivateKey(trimmed, encK);
    }
    if (getEnv('KEYUTILS_ALLOW_PLAINTEXT') === '1') {
        return trimmed;
    }
    if (/^0x[0-9a-fA-F]{64}$/i.test(trimmed)) {
        return '0x' + trimmed.slice(2).toLowerCase();
    }
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return '0x' + trimmed.toLowerCase();
    }
    throw new Error(
        `Private key in ${envVarName} must be v2: encrypted, valid 64-char hex, ` +
            'or set KEYUTILS_ALLOW_PLAINTEXT=1. Run npm run encrypt-key after setting ENC_K.'
    );
}

/**
 * @param {string} envVarName
 * @param {EnvGetter} [getEnv]
 * @returns {string}
 */
export function getPrivateKey(envVarName, getEnv = defaultNodeEnvGetter) {
    const blob = getEnv(envVarName);
    if (blob === undefined || blob === '') {
        throw new Error(`Environment variable ${envVarName} is not set`);
    }
    return interpretPrivateKeyBlob(blob.trim(), getEnv, envVarName);
}

/**
 * @param {string} envVarName
 * @param {EnvGetter} getEnv
 * @returns {string | null}
 */
export function tryGetPrivateKey(envVarName, getEnv) {
    const blob = getEnv(envVarName);
    if (blob === undefined || blob === null || String(blob).trim() === '') {
        return null;
    }
    return interpretPrivateKeyBlob(String(blob).trim(), getEnv, envVarName);
}
