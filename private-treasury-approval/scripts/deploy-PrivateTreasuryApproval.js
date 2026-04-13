import hardhat from "hardhat";
import { appendDeploymentLog, normalizeAddress, requireEnv } from "./helpers.js";

const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  const sourceInbox = normalizeAddress(requireEnv("SEPOLIA_INBOX_ADDRESS"), "SEPOLIA_INBOX_ADDRESS");
  const remoteCotiContract = normalizeAddress(
    requireEnv("PRIVATE_TREASURY_APPROVAL_COTI_ADDRESS"),
    "PRIVATE_TREASURY_APPROVAL_COTI_ADDRESS"
  );
  const cotiChainId = BigInt(process.env.COTI_CHAIN_ID || "7082400");

  console.log(`[deploy-source] deployer=${deployer.address}`);
  console.log(`[deploy-source] inbox=${sourceInbox}`);
  console.log(`[deploy-source] remoteCoti=${remoteCotiContract}`);
  console.log(`[deploy-source] cotiChainId=${cotiChainId}`);

  const factory = await ethers.getContractFactory("PrivateTreasuryApproval");
  const contract = await factory.deploy(sourceInbox, {
    gasLimit: 5_000_000,
  });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`[deploy-source] PrivateTreasuryApproval=${address}`);

  const tx = await contract.configure(ethers.ZeroAddress, remoteCotiContract, cotiChainId, {
    gasLimit: 500000,
  });
  await tx.wait();
  console.log("[deploy-source] configured");

  await appendDeploymentLog({
    contract: "PrivateTreasuryApproval",
    network: "sepolia",
    address,
  });
}

main().catch((error) => {
  console.error("[deploy-source] failed", error);
  process.exitCode = 1;
});
