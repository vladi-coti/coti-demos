import { useState, useLayoutEffect } from 'react';
import { ethers } from 'ethers';
import { readEnv } from '../lib/envRead.js';
import { MILLIONAIRE_COMPARISON_ABI } from '../lib/pod/abi.js';
import { retryWithBackoff, pollUntilReady } from '../lib/pod/async.js';
import { encryptDecimalWealth, parseUint64Wealth } from '../lib/pod/encryption.js';
import { formatCiphertext } from '../lib/pod/format.js';
import { parseComparisonRequestedFromReceipt } from '../lib/pod/inbox.js';
import { estimateCompareWealthFee } from '../lib/pod/fees.ts';
import { createPlayerWallet, requirePlayerWallet } from '../lib/pod/wallets.js';
import {
    getPodNetwork,
    resolvePodContractAddress,
    resolvePodRpcUrl,
} from '../lib/pod/network.js';

const PLAYER = {
    alice: { pk: 'VITE_ALICE_PK', aes: 'VITE_ALICE_AES_KEY', setFn: 'setAliceWealth' },
    bob: { pk: 'VITE_BOB_PK', aes: 'VITE_BOB_AES_KEY', setFn: 'setBobWealth' },
};

function ctBoolIsTrue(v) {
    return v === 1n || v === BigInt(1);
}

/**
 * @param {'sepolia' | 'avalanche'} networkId
 */
export function makeUseMillionaireContractPod(networkId) {
    const podCfg = getPodNetwork(networkId);

    return function useMillionaireContractPod() {
        const contractAddress = resolvePodContractAddress(podCfg);
        const rpcUrl = resolvePodRpcUrl(podCfg);
        const [aliceWallet, setAliceWallet] = useState(null);
        const [bobWallet, setBobWallet] = useState(null);

        useLayoutEffect(() => {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            setAliceWallet(createPlayerWallet('VITE_ALICE_PK', 'VITE_ALICE_AES_KEY', provider));
            setBobWallet(createPlayerWallet('VITE_BOB_PK', 'VITE_BOB_AES_KEY', provider));
        }, [rpcUrl]);

        const contractFor = (wallet) => {
            if (!contractAddress) {
                throw new Error(`Contract address not set (${podCfg.contractAddressHint})`);
            }
            return new ethers.Contract(contractAddress, MILLIONAIRE_COMPARISON_ABI, wallet);
        };

        const submitWealth = async (role, wealth) => {
            const cfg = PLAYER[role];
            const wallet = role === 'alice' ? aliceWallet : bobWallet;
            if (!wallet) throw new Error(`${role} wallet not configured`);
            if (!readEnv(cfg.aes)) {
                throw new Error(`${cfg.aes} required to submit wealth and decrypt results`);
            }

            const wealthValue = parseUint64Wealth(wealth);
            const encrypted = await encryptDecimalWealth(wealth, role, contractAddress, wallet.address);
            const contract = contractFor(wallet);

            return retryWithBackoff(async () => {
                const tx = await contract[cfg.setFn](encrypted, { gasLimit: 250_000 });
                const receipt = await tx.wait();
                return {
                    receipt,
                    wealthValue: wealthValue.toString(),
                    wealthInput: String(wealth).trim(),
                    encryptedCiphertext: formatCiphertext(encrypted.ciphertext),
                };
            });
        };

        const performComparison = async (wallet, label) => {
            if (!wallet) throw new Error(`${label} wallet not configured`);
            const contract = contractFor(wallet);
            if (!(await contract.areBothWealthsSet())) {
                throw new Error('Both Alice and Bob must submit their wealth before comparison');
            }

            return retryWithBackoff(async () => {
                const provider = wallet.provider;
                if (!provider) throw new Error('Wallet has no provider');
                const podInbox = await contract.inbox();
                const fee = await estimateCompareWealthFee(provider, podInbox);
                const tx = await contract.compareWealth(fee.callbackFeeWei, {
                    gasLimit: 1_500_000,
                    value: fee.totalFeeWei,
                });
                const receipt = await tx.wait();
                let podTrackRequestId;
                try {
                    podTrackRequestId = parseComparisonRequestedFromReceipt(receipt, contractAddress).requestIdBob;
                } catch (e) {
                    console.warn('Could not parse ComparisonRequested:', e);
                }
                return { transaction: tx, receipt, podInboxAddress: podInbox, podTrackRequestId };
            });
        };

        const readComparisonResult = async (wallet, readyFn, resultFn, onWaiting) => {
            if (!wallet) throw new Error('Wallet not configured');
            const contract = contractFor(wallet);
            const ready = await pollUntilReady(() => readyFn(contract), {
                pollIntervalMs: 5000,
                maxWaitMs: 600_000,
                onPoll: onWaiting,
            });
            if (!ready) throw new Error('Timeout waiting for MPC result');
            const ctResult = await resultFn(contract);
            const clear = await wallet.decryptValue(ctResult);
            return { raw: clear, isRicher: ctBoolIsTrue(clear) };
        };

        const getAliceComparisonResult = (onWaiting) =>
            readComparisonResult(
                aliceWallet,
                (c) => c.aliceResultReady(),
                (c) => c.getAliceResult(),
                onWaiting
            );

        const getBobComparisonResult = (onWaiting) =>
            readComparisonResult(
                bobWallet,
                (c) => c.bobResultReady(),
                (c) => c.getBobResult(),
                onWaiting
            );

        const getFullComparisonResult = async (onWaiting) => {
            if (!aliceWallet && !bobWallet) {
                throw new Error('At least one wallet must be configured');
            }
            const aliceContract = aliceWallet ? contractFor(aliceWallet) : null;
            const bobContract = bobWallet ? contractFor(bobWallet) : null;

            let readyParty = null;
            const ready = await pollUntilReady(
                async () => {
                    try {
                        if (bobContract && (await bobContract.bobResultReady())) {
                            readyParty = 'bob';
                            return true;
                        }
                        if (aliceContract && (await aliceContract.aliceResultReady())) {
                            readyParty = 'alice';
                            return true;
                        }
                    } catch (e) {
                        console.warn('result-ready poll failed:', e?.message || e);
                    }
                    return false;
                },
                { pollIntervalMs: 5000, maxWaitMs: 600_000, onPoll: onWaiting }
            );
            if (!ready) {
                throw new Error('Timeout waiting for the MPC callback. Try again shortly.');
            }

            const result =
                readyParty === 'bob'
                    ? await getBobComparisonResult()
                    : await getAliceComparisonResult();
            return {
                winner: result.isRicher ? 'alice' : 'not_alice',
                text: result.isRicher ? 'Alice is richer! 🎉' : 'Alice is not richer',
                aliceIsRicher: result.isRicher,
            };
        };

        const checkWealthStatus = async () => {
            if (!contractAddress) return { aliceSet: false, bobSet: false, bothSet: false };
            const wallet = aliceWallet || bobWallet;
            if (!wallet) return { aliceSet: false, bobSet: false, bothSet: false };
            try {
                const contract = contractFor(wallet);
                const [aliceSet, bobSet, bothSet] = await Promise.all([
                    retryWithBackoff(() => contract.isAliceWealthSet(), 3, 500),
                    retryWithBackoff(() => contract.isBobWealthSet(), 3, 500),
                    retryWithBackoff(() => contract.areBothWealthsSet(), 3, 500),
                ]);
                return { aliceSet, bobSet, bothSet };
            } catch (e) {
                console.error('Error checking wealth status:', e);
                return { aliceSet: false, bobSet: false, bothSet: false };
            }
        };

        const getEncryptedWealth = async (role) => {
            const cfg = PLAYER[role];
            const wallet = role === 'alice' ? aliceWallet : bobWallet;
            if (!wallet || !contractAddress) throw new Error(`${role} wallet or contract not configured`);
            const contract = contractFor(wallet);
            const getter = role === 'alice' ? 'getAliceWealth' : 'getBobWealth';
            const isSet = role === 'alice' ? 'isAliceWealthSet' : 'isBobWealthSet';
            if (!(await contract[isSet]())) return null;
            return formatCiphertext(await contract[getter]());
        };

        const resetContract = async () => {
            const signer = requirePlayerWallet(aliceWallet, 'VITE_ALICE_PK', rpcUrl);
            return retryWithBackoff(async () => {
                const tx = await contractFor(signer).reset({ gasLimit: 200_000 });
                const receipt = await tx.wait();
                return { receipt };
            });
        };

        return {
            submitAliceWealth: (wealth) => submitWealth('alice', wealth),
            submitBobWealth: (wealth) => submitWealth('bob', wealth),
            performComparison: (wallet, name) => performComparison(wallet, name),
            getAliceComparisonResult,
            getBobComparisonResult,
            getFullComparisonResult,
            checkWealthStatus,
            getEncryptedAliceWealth: () => getEncryptedWealth('alice'),
            getEncryptedBobWealth: () => getEncryptedWealth('bob'),
            resetContract,
            contractAddress,
            podRpcUrl: rpcUrl,
            podAppChainId: podCfg.appChainId,
            podNetworkId: networkId,
            aliceWallet,
            bobWallet,
        };
    };
}

export function useMillionaireContractPod() {
    return makeUseMillionaireContractPod('sepolia')();
}
