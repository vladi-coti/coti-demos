/**
 * Call COTI PoD `buildEncryptedInputs` (same service as @coti/pod-sdk) and return raw JSON fields.
 * Needed because bundled `CotiPodCrypto.encrypt` stringifies `signature` for non-String types, which breaks uint256.
 */

const DEFAULT_TESTNET = 'http://localhost:3004';
// const DEFAULT_TESTNET = 'https://fullnode.testnet.coti.io/pod-encryption';

/**
 * @param {string} value — decimal integer string (e.g. wei)
 * @param {'uint64'|'uint256'} dataType
 * @param {string} [networkOrUrl] — "testnet" | "mainnet" | full service base URL
 */
export async function fetchPodBuildEncryptedInputs(value, dataType, networkOrUrl = 'testnet') {
    const base =
        networkOrUrl === 'testnet' || networkOrUrl === 'mainnet'
            ? DEFAULT_TESTNET
            : networkOrUrl.replace(/\/$/, '');
    const url = `${base}/buildEncryptedInputs`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataType, value: String(value) }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`PoD encryption service error: ${text}`);
    }
    const data = await res.json();
    const ciphertext = data.ciphertext ?? data.cipherText;
    const signature = data.signature;
    if (ciphertext == null || signature == null) {
        throw new Error('PoD encryption response missing ciphertext or signature');
    }
    return { ciphertext, signature };
}
