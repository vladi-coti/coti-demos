import hardhat from "hardhat";
import { appendDeploymentLog, normalizeAddress, requireEnv } from "./helpers.js";

const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  const cotiInbox = normalizeAddress(requireEnv("COTI_INBOX_ADDRESS"), "COTI_INBOX_ADDRESS");

  console.log(`[deploy-coti] deployer=${deployer.address}`);
  console.log(`[deploy-coti] inbox=${cotiInbox}`);

  const factory = await ethers.getContractFactory("PrivateTreasuryApprovalCoti");
  const contract = await factory.deploy(cotiInbox, {
    gasLimit: 5_000_000,
  });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`[deploy-coti] PrivateTreasuryApprovalCoti=${address}`);

  await appendDeploymentLog({
    contract: "PrivateTreasuryApprovalCoti",
    network: "cotiTestnet",
    address,
  });
}

main().catch((error) => {
  console.error("[deploy-coti] failed", error);
  process.exitCode = 1;
});
