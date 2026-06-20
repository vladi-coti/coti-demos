import { Interface } from 'ethers';

const IFACE = new Interface([
    'event ComparisonRequested(address indexed requester, bytes32 requestIdAlice, bytes32 requestIdBob)',
]);

/** Parse `ComparisonRequested` from a compare tx receipt. */
export function parseComparisonRequestedFromReceipt(receipt, contractAddress) {
    const want = contractAddress.toLowerCase();
    for (const log of receipt.logs) {
        if (log.address?.toLowerCase() !== want) continue;
        try {
            const parsed = IFACE.parseLog({ topics: log.topics, data: log.data });
            if (parsed?.name === 'ComparisonRequested') {
                return {
                    requestIdAlice: String(parsed.args.requestIdAlice),
                    requestIdBob: String(parsed.args.requestIdBob),
                };
            }
        } catch {
            /* next log */
        }
    }
    throw new Error('ComparisonRequested event not found in transaction receipt');
}
