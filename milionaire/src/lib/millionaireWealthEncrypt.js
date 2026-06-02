import { readEnv } from './envRead.js';
import { parseUserAmountToWei } from './wealthWeiParse.js';
import { fetchPodBuildEncryptedInputs } from './podBuildEncryptedInputs.js';
import { podApiResponseToItUint256Arg } from './itUint256FromPodApi.js';

export { formatCtUint256ForDisplay } from './formatCtUint256ForDisplay.js';

/**
 * Decimal amount (PoD / Sepolia only) → fixed-point wei → PoD `buildEncryptedInputs` (uint256) → `itUint256` calldata tuple.
 * COTI native page uses `wallet.encryptValue` on an integer instead.
 */
export async function encryptDecimalWealthForMpc(decimalAmountString) {
    const dec = Number(readEnv('VITE_WEALTH_DECIMALS', '18'));
    const wei = parseUserAmountToWei(decimalAmountString, dec);
    const network =
        readEnv('VITE_POD_ENCRYPTION_URL') || readEnv('VITE_POD_ENCRYPTION_NETWORK') || 'testnet';
    const raw = await fetchPodBuildEncryptedInputs(wei.toString(), 'uint256', network);
    return podApiResponseToItUint256Arg(raw);
}
