/**
 * Cross-chain PoD request tracker — port of `coti-pod-sdk` {@link https://github.com/cotitech-io/coti-pod-sdk/blob/main/src/pod-request.ts PodRequest}.
 * Poll `trackRequest` until the outbound leg is settled (executed) or the tree reports an execution error.
 */

import { Contract, ethers } from 'ethers';
import {
    COTI_TESTNET_CHAIN_ID,
    COTI_TESTNET_DEFAULT_INBOX_ADDRESS,
    DEFAULT_COTI_TESTNET_RPC_URL,
    SEPOLIA_CHAIN_ID,
} from './defaults.js';
import { readEnv } from '../envRead.js';

export const ERROR_CODE_EXECUTION_FAILED = 1n;
export const ERROR_CODE_ENCODE_FAILED = 2n;

const INBOX_TRACKING_ABI = [
    'function requests(bytes32) view returns (' +
        'bytes32 requestId,' +
        'uint256 targetChainId,' +
        'address targetContract,' +
        '(bytes4 selector, bytes data, bytes8[] datatypes, bytes32[] datalens) methodCall,' +
        'address callerContract,' +
        'address originalSender,' +
        'uint64 timestamp,' +
        'bytes4 callbackSelector,' +
        'bytes4 errorSelector,' +
        'bool isTwoWay,' +
        'bool executed,' +
        'bytes32 sourceRequestId,' +
        'uint256 targetFee,' +
        'uint256 callerFee)',
    'function incomingRequests(bytes32) view returns (' +
        'bytes32 requestId,' +
        'uint256 targetChainId,' +
        'address targetContract,' +
        '(bytes4 selector, bytes data, bytes8[] datatypes, bytes32[] datalens) methodCall,' +
        'address callerContract,' +
        'address originalSender,' +
        'uint64 timestamp,' +
        'bytes4 callbackSelector,' +
        'bytes4 errorSelector,' +
        'bool isTwoWay,' +
        'bool executed,' +
        'bytes32 sourceRequestId,' +
        'uint256 targetFee,' +
        'uint256 callerFee)',
    'function errors(bytes32) view returns (bytes32 requestId, uint64 errorCode, bytes errorMessage)',
    'function inboxResponses(bytes32) view returns (bytes32 responseRequestId, bytes response)',
];

const ZERO_REQUEST_ID = ethers.ZeroHash;
const ERROR_STRING_SELECTOR = '0x08c379a0';
const PANIC_SELECTOR = '0x4e487b71';

/**
 * @param {string} raw
 * @returns {string}
 */
export function decodeInboxErrorMessage(raw) {
    if (!raw || raw === '0x') return '';
    const normalized = raw.toLowerCase();

    if (normalized.startsWith(ERROR_STRING_SELECTOR) && raw.length >= 10) {
        try {
            const [msg] = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + raw.slice(10));
            if (typeof msg === 'string' && msg.length > 0) return msg;
        } catch {
            /* fall through */
        }
    }

    if (normalized.startsWith(PANIC_SELECTOR) && raw.length >= 10) {
        try {
            const [code] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], '0x' + raw.slice(10));
            return `Panic(0x${BigInt(code).toString(16)})`;
        } catch {
            /* fall through */
        }
    }

    try {
        const text = ethers.toUtf8String(raw);
        if (text.length > 0 && /^[\x09\x0A\x0D\x20-\x7E]+$/.test(text)) return text;
    } catch {
        /* fall through */
    }

    return raw;
}

function normId(v) {
    return ethers.hexlify(v).toLowerCase();
}

function isZeroId(v) {
    try {
        return normId(v) === ZERO_REQUEST_ID;
    } catch {
        return true;
    }
}

/**
 * @typedef {object} ExecutionError
 * @property {bigint} errorCode
 * @property {string} errorMessage
 * @property {string} errorMessageRaw
 */

/**
 * @typedef {object} RequestTrackingResponse
 * @property {bigint} timestamp
 * @property {bigint} sourceChainId
 * @property {bigint} targetChainId
 * @property {string} requestId
 * @property {boolean} minedOnTarget
 * @property {boolean} isTwoWay
 * @property {RequestTrackingResponse | null} response
 * @property {bigint} localGasLimit
 * @property {bigint} remoteGasLimit
 * @property {ExecutionError | null} execution
 * @property {boolean} executed — from `requests(id)` on this hop (SDK TS omits; needed to detect callback completion)
 */

export class PodRequest {
    /**
     * @param {{ chains: { chainId: number; inboxAddress: string; rpcUrl: string }[] }} config
     */
    constructor(config) {
        if (!config?.chains?.length) {
            throw new Error('PodRequest: at least one chain is required');
        }
        /** @type {Map<string, { chainId: number; inboxAddress: string; rpcUrl: string }>} */
        this.chains = new Map();
        for (const c of config.chains) {
            const key = String(c.chainId);
            if (this.chains.has(key)) {
                throw new Error(`PodRequest: duplicate chain config for ${key}`);
            }
            if (!c.inboxAddress) {
                throw new Error(`PodRequest: inboxAddress missing for chain ${key}`);
            }
            if (!c.rpcUrl) {
                throw new Error(`PodRequest: rpcUrl missing for chain ${key}`);
            }
            this.chains.set(key, c);
        }
        /** @type {Map<string, Contract>} */
        this.inboxCache = new Map();
    }

    /** @param {number | bigint | string} chainId */
    inboxFor(chainId) {
        const key = String(BigInt(chainId));
        const cached = this.inboxCache.get(key);
        if (cached) return cached;
        const cfg = this.chains.get(key);
        if (!cfg) return undefined;
        const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, Number(cfg.chainId));
        const contract = new Contract(cfg.inboxAddress, INBOX_TRACKING_ABI, provider);
        this.inboxCache.set(key, contract);
        return contract;
    }

    /**
     * @param {number | bigint | string} chainId
     * @param {string} requestId
     * @returns {Promise<RequestTrackingResponse>}
     */
    async trackRequest(chainId, requestId) {
        return this._track(chainId, requestId, new Set());
    }

    /**
     * @param {number | bigint | string} chainId
     * @param {string} requestId
     * @param {Set<string>} seen
     * @returns {Promise<RequestTrackingResponse>}
     */
    async _track(chainId, requestId, seen) {
        const sourceKey = String(BigInt(chainId));
        const source = this.inboxFor(chainId);
        if (!source) {
            throw new Error(`PodRequest: no chain config for source chain ${sourceKey}`);
        }

        const id = normId(requestId);
        const seenKey = `${sourceKey}:${id}`;
        if (seen.has(seenKey)) {
            throw new Error(`PodRequest: cycle detected while tracking ${id}`);
        }
        seen.add(seenKey);

        const req = await source.requests(id);
        const storedId = normId(req.requestId);
        if (storedId === ZERO_REQUEST_ID) {
            throw new Error(`PodRequest: request ${id} not found on chain ${sourceKey}`);
        }

        const sourceChainId = BigInt(sourceKey);
        const targetChainId = BigInt(req.targetChainId);
        const isTwoWay = Boolean(req.isTwoWay);
        const timestamp = BigInt(req.timestamp);
        const remoteGasLimit = BigInt(req.targetFee);
        const localGasLimit = BigInt(req.callerFee);
        const executed = Boolean(req.executed);

        const target = this.inboxFor(targetChainId);

        let minedOnTarget = false;
        /** @type {ExecutionError | null} */
        let execution = null;
        let responseRequestId = ZERO_REQUEST_ID;

        if (target) {
            const [incoming, err, responseRecord] = await Promise.all([
                target.incomingRequests(id),
                target.errors(id),
                isTwoWay
                    ? target.inboxResponses(id)
                    : Promise.resolve({ responseRequestId: ZERO_REQUEST_ID, response: '0x' }),
            ]);

            minedOnTarget = !isZeroId(incoming.requestId);

            const errStoredId = normId(err.requestId);
            if (errStoredId !== ZERO_REQUEST_ID) {
                const rawMsg = ethers.hexlify(err.errorMessage);
                execution = {
                    errorCode: BigInt(err.errorCode),
                    errorMessage: decodeInboxErrorMessage(rawMsg),
                    errorMessageRaw: rawMsg,
                };
            }

            const respId = normId(responseRecord.responseRequestId);
            if (respId !== ZERO_REQUEST_ID) responseRequestId = responseRecord.responseRequestId;
        }

        /** @type {RequestTrackingResponse | null} */
        let response = null;
        if (!isZeroId(responseRequestId) && this.chains.has(targetChainId.toString())) {
            response = await this._track(targetChainId, responseRequestId, seen);
        }

        return {
            timestamp,
            sourceChainId,
            targetChainId,
            requestId: id,
            minedOnTarget,
            isTwoWay,
            response,
            localGasLimit,
            remoteGasLimit,
            execution,
            executed,
        };
    }
}

/**
 * First execution error in the tracking tree (target-side encode / subcall failure).
 * @param {RequestTrackingResponse} t
 * @returns {ExecutionError | null}
 */
export function findExecutionErrorInTree(t) {
    if (!t) return null;
    if (t.execution) return t.execution;
    return findExecutionErrorInTree(t.response);
}

/**
 * True when this PoD leg is done for the dApp: no execution errors anywhere in the tree, and the
 * **root** inbox row is `executed`.
 *
 * We intentionally do **not** require `response` subtree `executed` to match. On two-way flows the
 * nested `trackRequest` hop (return leg on COTI) can lag or disagree with RPC while Sepolia already
 * marks the outbound request executed after the callback — which matches app contract state.
 *
 * @param {RequestTrackingResponse} t
 * @returns {boolean}
 */
export function isPodTrackComplete(t) {
    if (findExecutionErrorInTree(t)) return false;
    return t.executed === true;
}

export function createMillionairePodRequest({ appChainId, appInboxAddress, appRpcUrl, cotiInboxAddress, cotiRpcUrl }) {
    const cotiInbox =
        cotiInboxAddress ||
        readEnv('VITE_POD_COTI_INBOX_ADDRESS') ||
        COTI_TESTNET_DEFAULT_INBOX_ADDRESS;
    const cotiRpc =
        cotiRpcUrl ||
        readEnv('COTI_TESTNET_RPC_URL') ||
        readEnv('VITE_COTI_RPC_URL') ||
        readEnv('VITE_COTI_APP_NODE_HTTPS_ADDRESS') ||
        readEnv('VITE_APP_NODE_HTTPS_ADDRESS') ||
        DEFAULT_COTI_TESTNET_RPC_URL;

    return new PodRequest({
        chains: [
            { chainId: appChainId ?? SEPOLIA_CHAIN_ID, inboxAddress: appInboxAddress, rpcUrl: appRpcUrl },
            { chainId: COTI_TESTNET_CHAIN_ID, inboxAddress: cotiInbox, rpcUrl: cotiRpc },
        ],
    });
}
