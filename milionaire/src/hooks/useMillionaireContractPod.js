import { useState, useLayoutEffect } from 'react';
import { ethers } from 'ethers';
import { Wallet } from '@coti-io/coti-ethers';
import { readEnv } from '../lib/envRead.js';
import { tryGetPrivateKey } from '../lib/KeyUtils.js';
import { estimateMillionairePodCompareWealthFee } from '../lib/podFeeUtils.ts';
import { parseComparisonRequestedFromReceipt } from '../lib/podInboxRequest.js';
import { parseUserAmountToWei } from '../lib/wealthWeiParse.js';
import { encryptDecimalWealthForMpc } from '../lib/millionaireWealthEncrypt.js';
import { formatCtUint256ForDisplay } from '../lib/formatCtUint256ForDisplay.js';
import {
    getPodNetwork,
    resolvePodContractAddress,
    resolvePodRpcUrl,
} from '../lib/podNetworkConfig.js';

// Retry utility for handling transient RPC errors
async function retryWithBackoff(
    fn,
    maxRetries = 3,
    initialDelay = 1000,
    errorHandler
) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if error is retryable
            const errorMessage = error?.message?.toLowerCase() || '';
            const errorCode = error?.code;

            // "already known" means transaction is already in mempool - not a real error
            if (errorMessage.includes('already known')) {
                console.log('Transaction already in mempool, waiting for confirmation...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
            }

            // Other retryable errors
            const isRetryable =
                errorMessage.includes('timeout') ||
                errorMessage.includes('network') ||
                errorMessage.includes('connection') ||
                errorMessage.includes('econnrefused') ||
                errorMessage.includes('nonce') ||
                errorCode === 'NETWORK_ERROR' ||
                errorCode === 'TIMEOUT' ||
                errorCode === 'SERVER_ERROR' ||
                errorCode === -32000;

            // Allow custom error handler to decide
            const shouldRetry = errorHandler ? errorHandler(error, attempt) : isRetryable;

            if (!shouldRetry || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff
            const delay = initialDelay * Math.pow(2, attempt - 1);
            console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

// Poll until a condition is true (for MPC result readiness; can take several minutes)
async function pollUntilReady(getReady, options = {}) {
    const { pollIntervalMs = 15000, maxWaitMs = 600000, onPoll } = options;
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
        const ready = await getReady();
        if (ready) return true;
        if (onPoll) onPoll();
        await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    return false;
}

// Contract ABI - only the functions we need
const MILLIONAIRE_COMPARISON_ABI = [
    "function setAliceWealth(tuple(tuple(tuple(uint256 high, uint256 low) high, tuple(uint256 high, uint256 low) low) ciphertext, bytes[2][2] signature) wealth) external",
    "function setBobWealth(tuple(tuple(tuple(uint256 high, uint256 low) high, tuple(uint256 high, uint256 low) low) ciphertext, bytes[2][2] signature) wealth) external",
    "function compareWealth(uint256 callbackFeeWei) external payable",
    "function inbox() external view returns (address)",
    "function isAliceWealthSet() external view returns (bool)",
    "function isBobWealthSet() external view returns (bool)",
    "function areBothWealthsSet() external view returns (bool)",
    "function aliceResultReady() external view returns (bool)",
    "function bobResultReady() external view returns (bool)",
    "function getAliceResult() external view returns (uint256)",  // ctBool is uint256 on-chain
    "function getBobResult() external view returns (uint256)",   // ctBool is uint256 on-chain
    "function getAliceAddress() external view returns (address)",
    "function getBobAddress() external view returns (address)",
    "function getAliceWealth() public view returns (tuple(tuple(tuple(uint256 high, uint256 low) high, tuple(uint256 high, uint256 low) low) high, tuple(tuple(uint256 high, uint256 low) high, tuple(uint256 high, uint256 low) low) low))",
    "function getBobWealth() public view returns (tuple(tuple(tuple(uint256 high, uint256 low) high, tuple(uint256 high, uint256 low) low) high, tuple(tuple(uint256 high, uint256 low) high, tuple(uint256 high, uint256 low) low) low))",
    "function reset() external"
];

/**
 * @param {'sepolia' | 'avalanche'} networkId
 * @returns {() => object} React hook bound to a PoD app chain (Sepolia or Avalanche Fuji).
 */
export function makeUseMillionaireContractPod(networkId) {
    const podCfg = getPodNetwork(networkId);

    return function useMillionaireContractPod() {
    const contractAddress = resolvePodContractAddress(podCfg);
    const rpcUrl = resolvePodRpcUrl(podCfg);

    const [aliceWallet, setAliceWallet] = useState(null);
    const [bobWallet, setBobWallet] = useState(null);

    const envGet = (k) => readEnv(k);

    // useLayoutEffect so wallet state exists before child passive useEffects (e.g. connection check on homepage).
    useLayoutEffect(() => {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        let alice = null;
        let bob = null;

        try {
            const pk = tryGetPrivateKey('VITE_ALICE_PK', envGet);
            if (pk) {
                alice = new Wallet(pk, provider);
                const aes = readEnv('VITE_ALICE_AES_KEY');
                if (aes) {
                    alice.setUserOnboardInfo({ aesKey: aes });
                }
            }
        } catch (e) {
            console.error('Alice wallet init failed:', e);
        }

        try {
            const pk = tryGetPrivateKey('VITE_BOB_PK', envGet);
            if (pk) {
                bob = new Wallet(pk, provider);
                const aes = readEnv('VITE_BOB_AES_KEY');
                if (aes) {
                    bob.setUserOnboardInfo({ aesKey: aes });
                }
            }
        } catch (e) {
            console.error('Bob wallet init failed:', e);
        }

        setAliceWallet(alice);
        setBobWallet(bob);
    }, [rpcUrl]);

    /** Alice signer for reset: use state, or rebuild from env (e.g. after a partial wallet init). */
    const getAliceSignerOrThrow = () => {
        if (aliceWallet) {
            return aliceWallet;
        }
        let pk;
        try {
            pk = tryGetPrivateKey('VITE_ALICE_PK', envGet);
        } catch (e) {
            throw new Error(
                `Alice wallet not configured: ${e.message}. Check VITE_ALICE_PK, ENC_K, and v2: ciphertext.`
            );
        }
        if (!pk) {
            throw new Error(
                'Alice wallet not configured. Set VITE_ALICE_PK in .env (and ENC_K if the value is v2:… encrypted).'
            );
        }
        try {
            return new Wallet(pk, new ethers.JsonRpcProvider(rpcUrl));
        } catch (e) {
            throw new Error(`Alice wallet not configured: invalid private key (${e.message})`);
        }
    };

    const getContract = (wallet) => {
        if (!contractAddress) {
            throw new Error(
                'Contract address not set. Set VITE_CONTRACT_ADDRESS_SEPOLIA or VITE_CONTRACT_ADDRESS in .env'
            );
        }
        return new ethers.Contract(contractAddress, MILLIONAIRE_COMPARISON_ABI, wallet);
    };

    const submitAliceWealth = async (wealth) => {
        if (!aliceWallet) {
            throw new Error('Alice wallet not configured. Please set VITE_ALICE_PK in .env');
        }
        if (!readEnv('VITE_ALICE_AES_KEY')) {
            throw new Error(
                'Alice AES key not configured. Set VITE_ALICE_AES_KEY in .env to submit wealth and decrypt comparison results.'
            );
        }

        const dec = Number(readEnv('VITE_WEALTH_DECIMALS', '18'));
        let wei;
        try {
            wei = parseUserAmountToWei(wealth, dec);
        } catch (e) {
            throw new Error(e?.message || 'Invalid wealth value');
        }

        console.log('Alice submitting wealth (wei):', wei.toString());

        const encryptedWealth = await encryptDecimalWealthForMpc(wealth);

        // Get contract instance
        const contract = getContract(aliceWallet);

        // Send transaction with retry logic
        return await retryWithBackoff(async () => {
            const tx = await contract.setAliceWealth(encryptedWealth, {
                gasLimit: 500000,
            });

            console.log('Transaction sent:', tx.hash);

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            console.log('Alice wealth stored successfully in block:', receipt.blockNumber);

            return {
                receipt,
                wealthWei: wei.toString(),
                wealthInput: String(wealth).trim(),
                encryptedCiphertext: formatCtUint256ForDisplay(encryptedWealth.ciphertext),
            };
        }, 3, 1000);
    };

    const submitBobWealth = async (wealth) => {
        if (!bobWallet) {
            throw new Error('Bob wallet not configured. Please set VITE_BOB_PK in .env');
        }
        if (!readEnv('VITE_BOB_AES_KEY')) {
            throw new Error(
                'Bob AES key not configured. Set VITE_BOB_AES_KEY in .env to submit wealth and decrypt comparison results.'
            );
        }

        const dec = Number(readEnv('VITE_WEALTH_DECIMALS', '18'));
        let wei;
        try {
            wei = parseUserAmountToWei(wealth, dec);
        } catch (e) {
            throw new Error(e?.message || 'Invalid wealth value');
        }

        console.log('Bob submitting wealth (wei):', wei.toString());

        const encryptedWealth = await encryptDecimalWealthForMpc(wealth);

        // Get contract instance
        const contract = getContract(bobWallet);

        // Send transaction with retry logic
        return await retryWithBackoff(async () => {
            const tx = await contract.setBobWealth(encryptedWealth, {
                gasLimit: 500000,
            });

            console.log('Transaction sent:', tx.hash);

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            console.log('Bob wealth stored successfully in block:', receipt.blockNumber);

            return {
                receipt,
                wealthWei: wei.toString(),
                wealthInput: String(wealth).trim(),
                encryptedCiphertext: formatCtUint256ForDisplay(encryptedWealth.ciphertext),
            };
        }, 3, 1000);
    };

    const performComparison = async (wallet, walletName) => {
        if (!wallet) {
            throw new Error(`${walletName} wallet not configured`);
        }

        const contract = getContract(wallet);

        // Check if both wealths are set
        const bothSet = await contract.areBothWealthsSet();
        console.log('Are both wealths set:', bothSet);

        if (!bothSet) {
            throw new Error('Both Alice and Bob must submit their wealth before comparison');
        }

        // Trigger the comparison (fee from inbox `calculateTwoWayFeeRequiredInLocalToken`; see podFeeUtils.ts)
        console.log(`${walletName} triggering comparison...`);
        const tx = await retryWithBackoff(async () => {
            const provider = wallet.provider;
            if (!provider) {
                throw new Error('Wallet has no provider; cannot estimate PoD fee');
            }
            const podInbox = await contract.inbox();
            const fee = await estimateMillionairePodCompareWealthFee(provider, podInbox);
            console.log('PoD compare fee estimate', {
                totalFeeWei: fee.totalFeeWei.toString(),
                callbackFeeWei: fee.callbackFeeWei.toString(),
            });
            const transaction = await contract.compareWealth(fee.callbackFeeWei, {
                gasLimit: 5000000,
                value: fee.totalFeeWei,
            });
            console.log('Comparison transaction sent:', transaction.hash);
            const receipt = await transaction.wait();
            console.log('Comparison completed in block:', receipt.blockNumber);
            const contractAddr = await contract.getAddress();
            let podTrackRequestId;
            try {
                podTrackRequestId = parseComparisonRequestedFromReceipt(receipt, contractAddr).requestIdBob;
            } catch (e) {
                console.warn('Could not parse ComparisonRequested for PoD tracker:', e);
            }
            return { transaction, receipt, podInboxAddress: podInbox, podTrackRequestId };
        }, 3, 1000);

        return tx;
    };

    const getAliceComparisonResult = async (onWaiting) => {
        if (!aliceWallet) {
            throw new Error('Alice wallet not configured');
        }
        if (!readEnv('VITE_ALICE_AES_KEY')) {
            throw new Error('Alice AES key not configured (required to decrypt comparison result)');
        }

        const contract = getContract(aliceWallet);

        // Wait for MPC result to be ready (can take a few minutes)
        const ready = await pollUntilReady(
            () => contract.aliceResultReady(),
            { pollIntervalMs: 5000, maxWaitMs: 600000, onPoll: onWaiting }
        );
        if (!ready) {
            throw new Error('Timeout waiting for Alice result from MPC. Try again later.');
        }

        // Get the encrypted result
        const ctResult = await contract.getAliceResult();
        console.log('Got encrypted result for Alice:', ctResult.toString());

        // Decrypt the result (boolean: true = Alice is richer, false = Alice is NOT richer)
        const clearResult = await aliceWallet.decryptValue(ctResult);
        console.log('Decrypted result for Alice:', clearResult);

        // Boolean result: true (1n) = Alice is richer
        const aliceIsRicher = clearResult === 1n || clearResult === BigInt(1);

        return {
            raw: clearResult,
            isRicher: aliceIsRicher // This actually means "Alice won"
        };
    };

    const getBobComparisonResult = async (onWaiting) => {
        if (!bobWallet) {
            throw new Error('Bob wallet not configured');
        }
        if (!readEnv('VITE_BOB_AES_KEY')) {
            throw new Error('Bob AES key not configured (required to decrypt comparison result)');
        }

        const contract = getContract(bobWallet);

        // Wait for MPC result to be ready (can take a few minutes)
        const ready = await pollUntilReady(
            () => contract.bobResultReady(),
            { pollIntervalMs: 5000, maxWaitMs: 600000, onPoll: onWaiting }
        );
        if (!ready) {
            throw new Error('Timeout waiting for Bob result from MPC. Try again later.');
        }

        // Get the encrypted result
        const ctResult = await contract.getBobResult();
        console.log('Got encrypted result for Bob:', ctResult.toString());

        // Decrypt the result (boolean: true = Alice is richer, false = Alice is NOT richer)
        const clearResult = await bobWallet.decryptValue(ctResult);
        console.log('Decrypted result for Bob:', clearResult);

        // Boolean result: true (1n) = Alice is richer
        // NOTE: The boolean answers "Is Alice Richer?". So if it's true, Alice won.
        // If it's false, Bob might have won or it's a tie.
        const aliceIsRicher = clearResult === 1n || clearResult === BigInt(1);

        return {
            raw: clearResult,
            isRicher: aliceIsRicher // This actually means "Alice won"
        };
    };

    /**
     * Get the comparison result. Polls aliceResultReady and bobResultReady until both are true,
     * then fetches and decrypts both results. Call onWaiting() during polling for UI feedback.
     *
     * @param {Function} [onWaiting] - Called on each poll while waiting for results (e.g. to show spinner).
     * @returns {Object} { winner: 'alice' | 'bob_or_tie', text: string, aliceIsRicher: boolean }
     */
    const getFullComparisonResult = async (onWaiting) => {
        if (!aliceWallet || !bobWallet) {
            throw new Error('Both wallets must be configured to get full result');
        }

        // Get both results (each polls its own ready flag and calls onWaiting)
        const aliceResult = await getAliceComparisonResult(onWaiting);
        const bobResult = await getBobComparisonResult(onWaiting);

        console.log('Alice says Alice is richer:', aliceResult.isRicher);
        console.log('Bob says Alice is richer:', bobResult.isRicher);

        // Determine winner based on the "Alice > Bob" check
        let winner;
        let text;
        const aliceIsStrictlyRicher = aliceResult.isRicher && bobResult.isRicher;

        if (aliceIsStrictlyRicher) {
            winner = 'alice';
            text = 'Alice is richer! 🎉';
        } else {
            // If false, it means Alice <= Bob
            winner = 'not_alice';
            text = 'Alice is not richer';
        }

        return {
            winner,
            text,
            aliceIsRicher: aliceIsStrictlyRicher
        };
    };

    const checkWealthStatus = async () => {
        if (!contractAddress) {
            return { aliceSet: false, bobSet: false, bothSet: false };
        }

        try {
            // Use alice wallet if available, otherwise bob wallet
            const wallet = aliceWallet || bobWallet;
            if (!wallet) {
                return { aliceSet: false, bobSet: false, bothSet: false };
            }

            const contract = getContract(wallet);
            const aliceSet = await retryWithBackoff(
                async () => await contract.isAliceWealthSet(),
                3,
                500
            );
            const bobSet = await retryWithBackoff(
                async () => await contract.isBobWealthSet(),
                3,
                500
            );
            const bothSet = await retryWithBackoff(
                async () => await contract.areBothWealthsSet(),
                3,
                500
            );

            return { aliceSet, bobSet, bothSet };
        } catch (error) {
            console.error('Error checking wealth status:', error);
            return { aliceSet: false, bobSet: false, bothSet: false };
        }
    };

    const getEncryptedAliceWealth = async () => {
        if (!aliceWallet) {
            throw new Error('Alice wallet not configured');
        }

        if (!contractAddress) {
            throw new Error('Contract address not set');
        }

        try {
            const contract = getContract(aliceWallet);

            // Check if Alice's wealth is set
            const isSet = await contract.isAliceWealthSet();
            if (!isSet) {
                return null;
            }

            // Get the encrypted wealth value from blockchain
            const encryptedWealth = await contract.getAliceWealth();
            console.log('Alice encrypted wealth from blockchain:', encryptedWealth);

            return formatCtUint256ForDisplay(encryptedWealth);
        } catch (error) {
            console.error('Error fetching Alice encrypted wealth:', error);
            throw error;
        }
    };

    const getEncryptedBobWealth = async () => {
        if (!bobWallet) {
            throw new Error('Bob wallet not configured');
        }

        if (!contractAddress) {
            throw new Error('Contract address not set');
        }

        try {
            const contract = getContract(bobWallet);

            // Check if Bob's wealth is set
            const isSet = await contract.isBobWealthSet();
            if (!isSet) {
                return null;
            }

            // Get the encrypted wealth value from blockchain
            const encryptedWealth = await contract.getBobWealth();
            console.log('Bob encrypted wealth from blockchain:', encryptedWealth);

            return formatCtUint256ForDisplay(encryptedWealth);
        } catch (error) {
            console.error('Error fetching Bob encrypted wealth:', error);
            throw error;
        }
    };

    const resetContract = async () => {
        const signer = getAliceSignerOrThrow();
        const contract = getContract(signer);

        return await retryWithBackoff(async () => {
            const tx = await contract.reset({ gasLimit: 200000 });
            console.log('Reset transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('Contract reset successfully in block:', receipt.blockNumber);
            return { receipt };
        }, 3, 1000);
    };

    return {
        submitAliceWealth,
        submitBobWealth,
        performComparison,
        getAliceComparisonResult,
        getBobComparisonResult,
        getFullComparisonResult,
        checkWealthStatus,
        getEncryptedAliceWealth,
        getEncryptedBobWealth,
        resetContract,
        contractAddress,
        podRpcUrl: rpcUrl,
        /** @deprecated use podRpcUrl */
        sepoliaRpcUrl: rpcUrl,
        podAppChainId: podCfg.appChainId,
        podNetworkId: networkId,
        aliceWallet,
        bobWallet
    };
    };
}

/** Default PoD hook (Sepolia) for backwards compatibility. */
export function useMillionaireContractPod() {
    return makeUseMillionaireContractPod('sepolia')();
}
