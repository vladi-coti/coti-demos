import { Contract, type Provider } from 'ethers';

const INBOX_ABI = [
    'function calculateTwoWayFeeRequiredInLocalToken(uint256 remoteMethodCallSize, uint256 callBackMethodCallSize, uint256 remoteMethodExecutionGas, uint256 callBackMethodExecutionGas, uint256 gasPrice) view returns (uint256 targetGasRemote, uint256 callerGasLocal)',
] as const;

/** Same fallback as inbox `InboxFeeManager.DEFAULT_GAS_PRICE`. */
const DEFAULT_GAS_PRICE_WEI = 2_000_000_000n;
/**
 * Floor matching `MillionaireComparisonPod.compareWealth`'s `require(msg.value >= 200 gwei)`.
 * Some testnet RPCs (e.g. Fuji) report a near-zero `gasPrice`, which would otherwise make the
 * estimated fee fall below this on-chain minimum and revert.
 */
const CONTRACT_MIN_TOTAL_FEE_WEI = 200_000_000_000n; // 200 gwei

const bigintMax = (a: bigint, b: bigint): bigint => (a > b ? a : b);
/**
 * Conservative `abi.encode(MpcMethodCall).length` for fee templates (real `gt64` payload is ~928 bytes).
 */
const REMOTE_METHOD_CALL_SIZE_BYTES = 2048n;
const CALLBACK_METHOD_CALL_SIZE_BYTES = 128n;
const REMOTE_METHOD_EXECUTION_GAS = 300_000n;
const CALLBACK_METHOD_EXECUTION_GAS = 300_000n;

export type PodCompareWealthFeeEstimate = {
    gasPriceWei: bigint;
    /** `calculateTwoWayFeeRequiredInLocalToken`: remote leg, converted to local native wei via oracle `mulDiv`. */
    totalFeeWei: bigint;
    /** `calculateTwoWayFeeRequiredInLocalToken`: local callback leg (wei). */
    callbackFeeWei: bigint;
};

/**
 * Fee for `MillionaireComparisonPod.compareWealth` using inbox `calculateTwoWayFeeRequiredInLocalToken`
 * (same remote→local conversion as on-chain `Math.mulDiv(targetGas, remoteTokenPrice, localTokenPrice)`).
 */
export async function estimateMillionairePodCompareWealthFee(
    provider: Provider,
    inboxAddress: string
): Promise<PodCompareWealthFeeEstimate> {
    const fd = await provider.getFeeData();
    // Floor to the inbox default so a near-zero RPC `gasPrice` can't yield a fee below the contract minimum.
    const gasPriceWei = bigintMax(
        fd.gasPrice ?? fd.maxFeePerGas ?? DEFAULT_GAS_PRICE_WEI,
        DEFAULT_GAS_PRICE_WEI
    );

    const inbox = new Contract(inboxAddress, INBOX_ABI, provider);
    const [targetGasRemoteInLocalWei, callerGasLocalWei] =
        await inbox.calculateTwoWayFeeRequiredInLocalToken(
            REMOTE_METHOD_CALL_SIZE_BYTES,
            CALLBACK_METHOD_CALL_SIZE_BYTES,
            REMOTE_METHOD_EXECUTION_GAS,
            CALLBACK_METHOD_EXECUTION_GAS,
            gasPriceWei
        );

    // 4x / 2x gas buffer, then enforce the on-chain floor `require(msg.value >= 200 gwei)`.
    const totalFeeWei = bigintMax(
        (targetGasRemoteInLocalWei + callerGasLocalWei) * 4n,
        CONTRACT_MIN_TOTAL_FEE_WEI
    );
    // compareWealth requires `callbackFeeWei < msg.value / 2` and `>= 1`.
    const maxCallbackFeeWei = totalFeeWei / 2n - 1n;
    let callbackFeeWei = callerGasLocalWei * 2n;
    if (callbackFeeWei > maxCallbackFeeWei) callbackFeeWei = maxCallbackFeeWei;
    if (callbackFeeWei < 1n) callbackFeeWei = 1n;

    return {
        gasPriceWei,
        totalFeeWei,
        callbackFeeWei,
    };
}
