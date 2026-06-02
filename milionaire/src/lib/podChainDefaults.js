/**
 * Default PoD inbox addresses (see @coti/pod-sdk `PodUserSepolia`, `InboxUserCotiTestnet`).
 * @see https://github.com/cotitech-io/coti-pod-sdk/blob/main/src/consts.ts
 */

export const SEPOLIA_CHAIN_ID = 11155111;
export const COTI_TESTNET_CHAIN_ID = 7082400;

export const SEPOLIA_DEFAULT_INBOX_ADDRESS = '0xB4A53FE02401fDFA8DAc00450dA3FfF8D01502F8';
export const COTI_TESTNET_DEFAULT_INBOX_ADDRESS = '0xB4A53FE02401fDFA8DAc00450dA3FfF8D01502F8';

/** COTI testnet MPC executor used by PoD routing (see @coti/pod-sdk `PodUserSepolia`). */
export const COTI_TESTNET_MPC_EXECUTOR_ADDRESS =
    '0x1084e11abd753b7a9d54e5fe5f8f2379d8c4a857';

/**
 * PoD inbox on Avalanche Fuji — set the real Fuji inbox here before `npm run deploy:pod:avalanche`.
 * The deploy script passes it to the contract's `configure()`; while `0x000…` the inbox stays unset.
 */
export const AVALANCHE_FUJI_DEFAULT_INBOX_ADDRESS =
    '0xB4A53FE02401fDFA8DAc00450dA3FfF8D01502F8';

export const DEFAULT_COTI_TESTNET_RPC_URL = 'https://testnet.coti.io/rpc';
