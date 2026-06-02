import { network } from "hardhat";
import { config as dotenvConfig } from 'dotenv';
import { getPrivateKey } from "../src/lib/KeyUtils.js";

dotenvConfig();

async function main() {
    const connection = await network.connect();
    const { ethers } = connection;
    console.log(`Deploying MillionaireComparison contract to ${connection.networkName}...`);

    // Get the deployer account
    const signers = await ethers.getSigners();
    if (signers.length === 0) {
        throw new Error("No signers available. Check your Hardhat configuration.");
    }
    const deployer = signers[0];
    console.log("Deploying with account:", deployer.address);

    // Get account balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Get Alice and Bob addresses from environment variables
    let aliceAddress, bobAddress;

    if (process.env.VITE_ALICE_PK?.trim() && process.env.VITE_BOB_PK?.trim()) {
        aliceAddress = new ethers.Wallet(getPrivateKey('VITE_ALICE_PK')).address;
        bobAddress = new ethers.Wallet(getPrivateKey('VITE_BOB_PK')).address;
        console.log("Alice address:", aliceAddress);
        console.log("Bob address:", bobAddress);
    } else {
        console.log("⚠️  Alice and Bob addresses not found in .env");
        console.log("Please set VITE_ALICE_PK and VITE_BOB_PK in your .env file");
        console.log("Deployment aborted.");
        process.exit(1);
    }

    // Deploy the MillionaireComparison contract
    const MillionaireComparison = await ethers.getContractFactory("MillionaireComparison");

    console.log("Deploying MillionaireComparison...");

    // The constructor takes no args; players are set via configurePlayers() after deploy.
    const millionaireComparison = await MillionaireComparison.deploy({
        gasLimit: 3000000,
        gasPrice: ethers.parseUnits("10", "gwei")
    });

    console.log("Transaction sent, waiting for confirmation...");

    // Wait for deployment to be mined
    await millionaireComparison.waitForDeployment();

    const contractAddress = await millionaireComparison.getAddress();
    console.log("MillionaireComparison deployed to:", contractAddress);

    // Verify deployment by checking if code exists at the address
    const deployedCode = await ethers.provider.getCode(contractAddress);
    if (deployedCode === "0x") {
        console.error("❌ Deployment failed - no code at contract address");
        process.exit(1);
    }

    console.log("Configuring players (Alice and Bob)...");
    const configureTx = await millionaireComparison.configurePlayers(
        aliceAddress,
        bobAddress,
        { gasLimit: 500000 }
    );
    await configureTx.wait();
    console.log("configurePlayers tx:", configureTx.hash);

    console.log("✅ MillionaireComparison successfully deployed!");
    console.log("Contract address:", contractAddress);
    console.log("Transaction hash:", millionaireComparison.deploymentTransaction()?.hash);

    // Save deployment info
    const deploymentInfo = {
        network: connection.networkName,
        contractName: "MillionaireComparison",
        contractAddress: contractAddress,
        deployerAddress: deployer.address,
        aliceAddress: aliceAddress,
        bobAddress: bobAddress,
        transactionHash: millionaireComparison.deploymentTransaction()?.hash,
        timestamp: new Date().toISOString()
    };

    console.log("\n🎉 Deployment Summary:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log("\n📝 Next steps:");
    console.log("1. Copy the contract address above");
    console.log("2. Update VITE_CONTRACT_ADDRESS in your .env file");
    console.log("3. Run 'npm run dev' to start the application");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
