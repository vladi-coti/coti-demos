import { ethers } from 'ethers';
import { Wallet } from '@coti-io/coti-ethers';
import { readEnv } from '../envRead.js';
import { tryGetPrivateKey } from '../KeyUtils.js';

export function createPlayerWallet(pkEnvKey, aesEnvKey, provider, envGet = readEnv) {
    try {
        const pk = tryGetPrivateKey(pkEnvKey, envGet);
        if (!pk) return null;
        const wallet = new Wallet(pk, provider);
        const aes = readEnv(aesEnvKey);
        if (aes) wallet.setUserOnboardInfo({ aesKey: aes });
        return wallet;
    } catch (e) {
        console.error(`${pkEnvKey} wallet init failed:`, e);
        return null;
    }
}

export function requirePlayerWallet(stateWallet, pkEnvKey, rpcUrl, envGet = readEnv) {
    if (stateWallet) return stateWallet;
    const pk = tryGetPrivateKey(pkEnvKey, envGet);
    if (!pk) {
        throw new Error(`Wallet not configured. Set ${pkEnvKey} in .env (and ENC_K if v2: encrypted).`);
    }
    return new Wallet(pk, new ethers.JsonRpcProvider(rpcUrl));
}
