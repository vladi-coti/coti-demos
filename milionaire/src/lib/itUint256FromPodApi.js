import { ethers } from 'ethers';

function hx(s) {
    const t = String(s).trim();
    if (!t) return '0x';
    return t.startsWith('0x') ? t : `0x${t}`;
}

function toBig(v) {
    if (typeof v === 'bigint') return v;
    return BigInt(hx(String(v)));
}

/**
 * Map PoD encryption JSON (uint256) to Solidity `itUint256` tuple for ethers `Contract.setAliceWealth(...)`.
 * Shape matches live testnet response from `buildEncryptedInputs`.
 *
 * @param {{ ciphertext: object, signature: string[][] }} enc
 * @returns {{ ciphertext: object, signature: string[][] }}
 */
export function podApiResponseToItUint256Arg(enc) {
    const ch = enc.ciphertext;
    if (!ch?.high?.high || !enc.signature || !Array.isArray(enc.signature)) {
        throw new Error('Invalid uint256 encrypt response (expected nested ciphertext + signature matrix)');
    }
    return {
        ciphertext: {
            high: {
                high: toBig(ch.high.high),
                low: toBig(ch.high.low),
            },
            low: {
                high: toBig(ch.low.high),
                low: toBig(ch.low.low),
            },
        },
        signature: enc.signature.map((row) => row.map((b) => hx(String(b)))),
    };
}
