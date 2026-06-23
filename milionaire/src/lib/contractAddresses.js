/**
 * Public deployed contract addresses.
 *
 * These are not secrets, so keep them in git instead of .env. Leave a value as
 * an empty string until that network is deployed.
 */
export const MILLIONAIRE_CONTRACT_ADDRESSES = {
    7082400: '0xE8d8CAAeB1256e0A29Fe266Cc8037e1861354177', // COTI Testnet
    11155111: '0x77e1Bc02FFa7A321a6492452170b173546e42511', // Sepolia
    43113: '0xa39CBB61bc004823D761A381ccD69eE2d186F42A', // Avalanche Fuji
};

export function configuredAddress(address) {
    return typeof address === 'string' && address.trim() ? address.trim() : '';
}

export function getMillionaireContractAddress(chainId) {
    return configuredAddress(MILLIONAIRE_CONTRACT_ADDRESSES[String(chainId)]);
}
