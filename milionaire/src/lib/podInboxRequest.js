import { Interface } from 'ethers';

const COMPARISON_REQUESTED_IFACE = new Interface([
    'event ComparisonRequested(address indexed requester, bytes32 requestIdAlice, bytes32 requestIdBob)',
]);

/**
 * Parse `ComparisonRequested` from the compare tx receipt and return both inbox request ids.
 * Bob's id is the second `gt64` leg — use with {@link ../lib/podRequestTrack.js PodRequest.trackRequest}.
 */
export function parseComparisonRequestedFromReceipt(receipt, millionaireContractAddress) {
    const want = millionaireContractAddress.toLowerCase();
    for (const log of receipt.logs) {
        if (!log.address || log.address.toLowerCase() !== want) continue;
        let parsed;
        try {
            parsed = COMPARISON_REQUESTED_IFACE.parseLog({
                topics: log.topics,
                data: log.data,
            });
        } catch {
            continue;
        }
        if (parsed?.name !== 'ComparisonRequested') continue;
        const { requestIdAlice, requestIdBob } = parsed.args;
        return {
            requestIdAlice: String(requestIdAlice),
            requestIdBob: String(requestIdBob),
        };
    }
    throw new Error('ComparisonRequested event not found in transaction receipt');
}
