import { ethers } from 'ethers';
import { readEnv } from '../envRead.js';
import { parseUserAmountToWei } from '../wealthWeiParse.js';

const ENCRYPTION_URL = 'https://fullnode.testnet.coti.io/pod-encryption';

const WEALTH_ABI = new ethers.Interface([
    'function setAliceWealth(tuple(tuple(uint256 ciphertextHigh, uint256 ciphertextLow) ciphertext, bytes signature) wealth) external',
    'function setBobWealth(tuple(tuple(uint256 ciphertextHigh, uint256 ciphertextLow) ciphertext, bytes signature) wealth) external',
]);
export const SET_ALICE_WEALTH_SELECTOR = WEALTH_ABI.getFunction('setAliceWealth').selector;
export const SET_BOB_WEALTH_SELECTOR = WEALTH_ABI.getFunction('setBobWealth').selector;

function hex(v) {
    const t = String(v).trim();
    return t.startsWith('0x') ? t : `0x${t}`;
}

/** PoD service `buildEncryptedInputs` → pod-mpc-lib flat `itUint256`. */
export function mapPodUint256Response({ ciphertext, signature }) {
    if (ciphertext?.ciphertextHigh == null || ciphertext?.ciphertextLow == null || typeof signature !== 'string') {
        throw new Error('Invalid uint256 encrypt response (expected ciphertextHigh, ciphertextLow, signature)');
    }
    return {
        ciphertext: {
            ciphertextHigh: BigInt(hex(ciphertext.ciphertextHigh)),
            ciphertextLow: BigInt(hex(ciphertext.ciphertextLow)),
        },
        signature: hex(signature),
    };
}

async function fetchEncryptedInputs(value, signingContext = {}) {
    const res = await fetch(`${ENCRYPTION_URL}/buildEncryptedInputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dataType: 'uint256',
            value: String(value),
            ...signingContext,
        }),
    });
    if (!res.ok) {
        throw new Error(`PoD encryption service error: ${await res.text()}`);
    }
    const data = await res.json();
    const ciphertext = data.ciphertext ?? data.cipherText;
    if (ciphertext == null || data.signature == null) {
        throw new Error('PoD encryption response missing ciphertext or signature');
    }
    return { ciphertext, signature: data.signature };
}

/**
 * @param {string} decimalAmount
 * @param {'alice'|'bob'} role
 * @param {string} contractAddress
 * @param {string} userAddress
 */
export async function encryptDecimalWealth(decimalAmount, role, contractAddress, userAddress) {
    const wei = parseUserAmountToWei(decimalAmount, Number(readEnv('VITE_WEALTH_DECIMALS', '18')));
    const enc = await fetchEncryptedInputs(wei.toString(), {
        contractAddress,
        functionSelector: role === 'alice' ? SET_ALICE_WEALTH_SELECTOR : SET_BOB_WEALTH_SELECTOR,
        userAddress,
        aesKey: readEnv(role === 'alice' ? 'VITE_ALICE_AES_KEY' : 'VITE_BOB_AES_KEY'),
    });
    return mapPodUint256Response(enc);
}
