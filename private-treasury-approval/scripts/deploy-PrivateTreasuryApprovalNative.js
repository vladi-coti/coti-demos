import hardhat from "hardhat";
import { appendDeploymentLog } from "./helpers.js";

const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`[deploy-native] deployer=${deployer.address}`);

  const factory = await ethers.getContractFactory("PrivateTreasuryApprovalNative");
  const contract = await factory.deploy({
    gasLimit: 5_000_000,
  });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`[deploy-native] PrivateTreasuryApprovalNative=${address}`);

  await appendDeploymentLog({
    contract: "PrivateTreasuryApprovalNative",
    network: "cotiTestnet",
    address,
  });
}

main().catch((error) => {
  console.error("[deploy-native] failed", error);
  process.exitCode = 1;
});
