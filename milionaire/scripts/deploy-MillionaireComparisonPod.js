/**
 * Deploy the single `MillionaireComparisonPod` contract to Sepolia or Avalanche Fuji.
 *
 * The contract is network-agnostic; the per-network inbox and COTI routing are set
 * post-deploy via the SDK's owner-only `configure(inbox, mpcExecutor, cotiChainId)`.
 *
 * Sepolia: uses `SEPOLIA_DEFAULT_INBOX_ADDRESS`.
 * Fuji: set `AVALANCHE_FUJI_DEFAULT_INBOX_ADDRESS` in `src/lib/pod/defaults.js` before deploy
 *       (while it is `0x000…`, `configure` leaves the inbox unset).
 *
 *   npm run deploy:pod
 *   npm run deploy:pod:avalanche
 */
import { network } from 'hardhat';
import { config as dotenvConfig } from 'dotenv';
import { getPrivateKey } from '../src/lib/KeyUtils.js';
import {
    AVALANCHE_FUJI_DEFAULT_INBOX_ADDRESS,
    COTI_TESTNET_CHAIN_ID,
    COTI_TESTNET_MPC_EXECUTOR_ADDRESS,
    SEPOLIA_DEFAULT_INBOX_ADDRESS,
} from '../src/lib/pod/defaults.js';

dotenvConfig();

const CONTRACT_NAME = 'MillionaireComparisonPod';

const DEPLOY_TARGETS = {
    sepolia: {
        contractName: CONTRACT_NAME,
        envKey: 'VITE_CONTRACT_ADDRESS_SEPOLIA',
        inbox: SEPOLIA_DEFAULT_INBOX_ADDRESS,
    },
    avalancheFuji: {
        contractName: CONTRACT_NAME,
        envKey: 'VITE_CONTRACT_ADDRESS_AVALANCHE_FUJI',
        inbox: AVALANCHE_FUJI_DEFAULT_INBOX_ADDRESS,
    },
};

async function main() {
    if (process.env.HARDHAT_CONTRACTS_SCOPE !== 'pod') {
        console.error(
            'This script needs the PoD contract scope. Set HARDHAT_CONTRACTS_SCOPE=pod, or use the npm scripts:',
        );
        console.error('  npm run deploy:pod            (Sepolia)');
        console.error('  npm run deploy:pod:avalanche  (Avalanche Fuji)');
        process.exit(1);
    }

    const connection = await network.connect();
    const { ethers } = connection;
    const networkName = connection.networkName;
    const target = DEPLOY_TARGETS[networkName];

    if (!target) {
        console.error('Unsupported network:', networkName);
        console.error('Use sepolia or avalancheFuji.');
        process.exit(1);
    }

    console.log(`Deploying ${target.contractName} to`, networkName, '...');

    const signers = await ethers.getSigners();
    if (signers.length === 0) {
        throw new Error(
            'No signers. Set DEPLOYER_PRIVATE_KEY (and Fuji test AVAX for avalancheFuji).',
        );
    }
    const deployer = signers[0];
    console.log('Deployer (owner):', deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('Deployer balance:', ethers.formatEther(balance), 'native');

    if (!process.env.VITE_ALICE_PK?.trim() || !process.env.VITE_BOB_PK?.trim()) {
        console.error('Set VITE_ALICE_PK and VITE_BOB_PK in .env');
        process.exit(1);
    }

    const aliceAddress = new ethers.Wallet(getPrivateKey('VITE_ALICE_PK')).address;
    const bobAddress = new ethers.Wallet(getPrivateKey('VITE_BOB_PK')).address;
    console.log('Alice:', aliceAddress);
    console.log('Bob:  ', bobAddress);

    const Factory = await ethers.getContractFactory(target.contractName);
    const contract = await Factory.deploy({ gasLimit: 4_000_000 });

    console.log('Deployment tx:', contract.deploymentTransaction()?.hash);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    if ((await ethers.provider.getCode(address)) === '0x') {
        console.error('No bytecode at address — deployment failed.');
        process.exit(1);
    }

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    if (target.inbox && target.inbox !== ZERO_ADDRESS) {
        console.log('Configuring inbox + COTI routing…');
        const cfgTx = await contract.configure(
            target.inbox,
            COTI_TESTNET_MPC_EXECUTOR_ADDRESS,
            COTI_TESTNET_CHAIN_ID,
            { gasLimit: 200_000 },
        );
        await cfgTx.wait();
        console.log('configure tx:', cfgTx.hash);
    } else {
        console.warn(
            `⚠️  No inbox set for ${networkName}. Set its address in src/lib/pod/defaults.js, then call configure() before use.`,
        );
    }

    const inbox = await contract.inbox();
    console.log('inbox():', inbox);

    console.log('Configuring players…');
    const tx = await contract.configurePlayers(aliceAddress, bobAddress, {
        gasLimit: 500_000,
    });
    await tx.wait();
    console.log('configurePlayers tx:', tx.hash);

    console.log(`\n✅ ${target.contractName} deployed at:`, address);
    console.log(`\nAdd to .env:\n  ${target.envKey}=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
