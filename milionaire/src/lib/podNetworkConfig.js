import { readEnv } from './envRead.js';
import {
    AVALANCHE_FUJI_DEFAULT_INBOX_ADDRESS,
    COTI_TESTNET_CHAIN_ID,
    SEPOLIA_CHAIN_ID,
    SEPOLIA_DEFAULT_INBOX_ADDRESS,
} from './podChainDefaults.js';

/** @typedef {'coti' | 'sepolia' | 'avalanche'} DemoNetworkId */

/** Avalanche Fuji / C-Chain testnet */
export const AVALANCHE_FUJI_CHAIN_ID = 43113;

export const AVALANCHE_FUJI_DEFAULT_RPC_URL =
    'https://api.avax-test.network/ext/bc/C/rpc';

/**
 * PoD demo chains: contract lives on `app` chain; MPC runs on COTI testnet via inbox.
 * Inbox: set per-network at deploy via the contract's `configure()` (see `podChainDefaults.js`).
 */
export const POD_NETWORKS = {
    sepolia: {
        id: 'sepolia',
        label: 'Sepolia (Privacy on Demand)',
        routePath: '/sepolia',
        appChainId: SEPOLIA_CHAIN_ID,
        contractAddressEnv: ['VITE_CONTRACT_ADDRESS_SEPOLIA', 'VITE_CONTRACT_ADDRESS'],
        rpcUrlEnv: ['SEPOLIA_RPC_URL'],
        rpcDefault: 'https://rpc.sepolia.org',
        explorer: {
            tx: (hash) => `https://sepolia.etherscan.io/tx/${hash}`,
            address: (addr) => `https://sepolia.etherscan.io/address/${addr}`,
            podRequest: (requestId) => {
                const t = readEnv('VITE_POD_REQUEST_EXPLORER_URL');
                if (!t || !requestId) return null;
                return t.replaceAll('{requestId}', requestId);
            },
        },
        contractAddressHint:
            'VITE_CONTRACT_ADDRESS_SEPOLIA (or VITE_CONTRACT_ADDRESS)',
        defaultInboxAddress: SEPOLIA_DEFAULT_INBOX_ADDRESS,
    },
    avalanche: {
        id: 'avalanche',
        label: 'Avalanche Fuji (Privacy on Demand)',
        routePath: '/avalanche',
        appChainId: AVALANCHE_FUJI_CHAIN_ID,
        contractAddressEnv: [
            'VITE_CONTRACT_ADDRESS_AVALANCHE_FUJI',
            'VITE_CONTRACT_ADDRESS',
        ],
        rpcUrlEnv: ['AVALANCHE_FUJI_RPC_URL', 'VITE_AVALANCHE_FUJI_RPC_URL'],
        rpcDefault: AVALANCHE_FUJI_DEFAULT_RPC_URL,
        explorer: {
            tx: (hash) => `https://testnet.snowtrace.io/tx/${hash}`,
            address: (addr) => `https://testnet.snowtrace.io/address/${addr}`,
            podRequest: (requestId) => {
                const t =
                    readEnv('VITE_POD_REQUEST_EXPLORER_URL_AVALANCHE') ||
                    readEnv('VITE_POD_REQUEST_EXPLORER_URL');
                if (!t || !requestId) return null;
                return t.replaceAll('{requestId}', requestId);
            },
        },
        contractAddressHint:
            'VITE_CONTRACT_ADDRESS_AVALANCHE_FUJI (or VITE_CONTRACT_ADDRESS)',
        defaultInboxAddress: AVALANCHE_FUJI_DEFAULT_INBOX_ADDRESS,
    },
};

/** @param {string} networkId */
export function getPodNetwork(networkId) {
    const cfg = POD_NETWORKS[networkId];
    if (!cfg) {
        throw new Error(`Unknown PoD network: ${networkId}`);
    }
    return cfg;
}

/** @param {string} networkId */
export function isPodDemoNetwork(networkId) {
    return networkId === 'sepolia' || networkId === 'avalanche';
}

/** @param {typeof POD_NETWORKS.sepolia} cfg */
export function resolvePodContractAddress(cfg) {
    for (const key of cfg.contractAddressEnv) {
        const v = readEnv(key);
        if (v?.trim()) return v.trim();
    }
    return '';
}

/** @param {typeof POD_NETWORKS.sepolia} cfg */
export function resolvePodRpcUrl(cfg) {
    for (const key of cfg.rpcUrlEnv) {
        const v = readEnv(key);
        if (v?.trim()) return v.trim();
    }
    return cfg.rpcDefault;
}

export { COTI_TESTNET_CHAIN_ID };
