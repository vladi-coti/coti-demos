import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const normalizePk = (value) => {
  if (!value) return value;
  return value.startsWith("0x") ? value : `0x${value}`;
};

const accounts = [
  process.env.DEPLOYER_PRIVATE_KEY,
  process.env.VITE_OWNER_PK,
  process.env.VITE_APPROVER_PK,
]
  .filter(Boolean)
  .map(normalizePk);

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.VITE_SOURCE_RPC_URL || "",
      chainId: 11155111,
      accounts,
      timeout: 120000,
    },
    cotiTestnet: {
      url: process.env.COTI_TESTNET_RPC_URL || process.env.VITE_COTI_RPC_URL || "https://testnet.coti.io/rpc",
      chainId: Number(process.env.COTI_CHAIN_ID || 7082400),
      accounts,
      timeout: 120000,
      gas: 5000000,
      gasPrice: 10000000000,
    },
  },
  etherscan: {
    apiKey: {
      cotiTestnet: "abc",
      sepolia: "abc",
    },
    customChains: [
      {
        network: "cotiTestnet",
        chainId: Number(process.env.COTI_CHAIN_ID || 7082400),
        urls: {
          apiURL: "https://testnet.cotiscan.io/api",
          browserURL: "https://testnet.cotiscan.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
