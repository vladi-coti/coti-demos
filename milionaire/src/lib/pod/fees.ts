import { Contract, type Provider } from 'ethers';

const INBOX_ABI = [
    'function calculateTwoWayFeeRequiredInLocalToken(uint256 remoteMethodCallSize, uint256 callBackMethodCallSize, uint256 remoteMethodExecutionGas, uint256 callBackMethodExecutionGas, uint256 gasPrice) view returns (uint256 targetGasRemote, uint256 callerGasLocal)',
] as const;

const DEFAULT_GAS_PRICE_WEI = 2_000_000_000n;
const CONTRACT_MIN_TOTAL_FEE_WEI = 200_000_000_000n;
const REMOTE_METHOD_CALL_SIZE_BYTES = 2048n;
const CALLBACK_METHOD_CALL_SIZE_BYTES = 128n;
const REMOTE_METHOD_EXECUTION_GAS = 300_000n;
const CALLBACK_METHOD_EXECUTION_GAS = 300_000n;
const REMOTE_GAS_BUFFER = 4n;
const CALLBACK_GAS_BUFFER = 8n;

const max = (a: bigint, b: bigint) => (a > b ? a : b);

export type PodCompareWealthFeeEstimate = {
    gasPriceWei: bigint;
    totalFeeWei: bigint;
    callbackFeeWei: bigint;
};

/** Inbox fee estimate for `compareWealth` (remote + callback legs). */
export async function estimateCompareWealthFee(
    provider: Provider,
    inboxAddress: string
): Promise<PodCompareWealthFeeEstimate> {
    const fd = await provider.getFeeData();
    const gasPriceWei = max(fd.maxFeePerGas ?? fd.gasPrice ?? DEFAULT_GAS_PRICE_WEI, DEFAULT_GAS_PRICE_WEI);

    const inbox = new Contract(inboxAddress, INBOX_ABI, provider);
    const [targetGasRemoteInLocalWei, callerGasLocalWei] =
        await inbox.calculateTwoWayFeeRequiredInLocalToken(
            REMOTE_METHOD_CALL_SIZE_BYTES,
            CALLBACK_METHOD_CALL_SIZE_BYTES,
            REMOTE_METHOD_EXECUTION_GAS,
            CALLBACK_METHOD_EXECUTION_GAS,
            gasPriceWei
        );

    const callbackBudgetWei = callerGasLocalWei * CALLBACK_GAS_BUFFER;
    const totalFeeWei = max(
        targetGasRemoteInLocalWei * REMOTE_GAS_BUFFER + callbackBudgetWei,
        CONTRACT_MIN_TOTAL_FEE_WEI
    );
    const maxCallbackFeeWei = totalFeeWei - 1n;
    let callbackFeeWei = callbackBudgetWei;
    if (callbackFeeWei > maxCallbackFeeWei) callbackFeeWei = maxCallbackFeeWei;
    if (callbackFeeWei < 1n) callbackFeeWei = 1n;

    return { gasPriceWei, totalFeeWei, callbackFeeWei };
}

/** @deprecated use estimateCompareWealthFee */
export const estimateMillionairePodCompareWealthFee = estimateCompareWealthFee;
