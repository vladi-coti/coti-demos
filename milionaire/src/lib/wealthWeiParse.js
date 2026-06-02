import { ethers } from 'ethers';

const MAX_WEI = (1n << 256n) - 1n;

/**
 * Parse a user-entered decimal amount into wei (fixed-point → integer).
 * @param {string} raw
 * @param {number} [decimals=18]
 * @returns {bigint}
 */
export function parseUserAmountToWei(raw, decimals = 18) {
    const s = String(raw ?? '')
        .trim()
        .replace(/,/g, '');
    if (!s) {
        throw new Error('Amount is required');
    }
    if (s.startsWith('-')) {
        throw new Error('Amount must be non-negative');
    }
    const dec = Number(decimals);
    if (!Number.isInteger(dec) || dec < 0 || dec > 78) {
        throw new Error('Invalid decimal places configuration');
    }
    let wei;
    try {
        wei = ethers.parseUnits(s, dec);
    } catch (e) {
        throw new Error(`Invalid amount: ${e?.message || e}`);
    }
    if (wei > MAX_WEI) {
        throw new Error('Amount exceeds 256-bit range');
    }
    return wei;
}
