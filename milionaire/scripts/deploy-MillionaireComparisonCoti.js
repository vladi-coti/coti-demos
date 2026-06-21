/**
 * Deploy the COTI-side Millionaires' Problem private logic contract.
 *
 *   HARDHAT_CONTRACTS_SCOPE=pod hardhat run scripts/deploy-MillionaireComparisonCoti.js --network cotiTestnet
 */
import { network } from 'hardhat';
import { config as dotenvConfig } from 'dotenv';
import { COTI_TESTNET_DEFAULT_INBOX_ADDRESS } from '../src/lib/pod/defaults.js';

dotenvConfig();

const CONTRACT_NAME = 'MillionaireComparisonCoti';

async function main() {
    if (process.env.HARDHAT_CONTRACTS_SCOPE !== 'pod') {
        console.error('This script needs the PoD contract scope. Set HARDHAT_CONTRACTS_SCOPE=pod.');
        process.exit(1);
    }

    const connection = await network.connect();
    const { ethers } = connection;

    console.log(`Deploying ${CONTRACT_NAME} to`, connection.networkName, '...');
    const [deployer] = await ethers.getSigners();
    if (!deployer) throw new Error('No signer. Set DEPLOYER_PRIVATE_KEY or VITE_ALICE_PK.');

    console.log('Deployer:', deployer.address);
    console.log('Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'native');
    console.log('Inbox:', COTI_TESTNET_DEFAULT_INBOX_ADDRESS);

    const Factory = await ethers.getContractFactory(CONTRACT_NAME);
    const contract = await Factory.deploy(COTI_TESTNET_DEFAULT_INBOX_ADDRESS, { gasLimit: 8_000_000 });
    console.log('Deployment tx:', contract.deploymentTransaction()?.hash);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`\n✅ ${CONTRACT_NAME} deployed at:`, address);
    console.log('\nUse this when deploying/configuring the host PoD contract:');
    console.log(`  COTI_TESTNET_MPC_EXECUTOR_ADDRESS=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
