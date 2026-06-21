import "@nomicfoundation/hardhat-ignition";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import { getPrivateKey } from "./src/lib/KeyUtils.js";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

/** `coti` (default): native MPC contract. `pod`: MillionaireComparisonPod + pod-mpc-lib PoD contracts (OZ v5, solc 0.8.26). */
const scope = process.env.HARDHAT_CONTRACTS_SCOPE === "pod" ? "pod" : "coti";

/** COTI testnet RPC (Hardhat does not read Vite envPrefix) */
const cotiRpc =
    process.env.COTI_TESTNET_RPC_URL ||
    process.env.VITE_COTI_RPC_URL ||
    process.env.VITE_COTI_APP_NODE_HTTPS_ADDRESS ||
    process.env.VITE_APP_NODE_HTTPS_ADDRESS ||
    "https://testnet.coti.io/rpc";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
    plugins: [hardhatEthers, hardhatVerify],
    /** Cotiscan (Blockscout) for `hardhat verify blockscout` on COTI testnet */
    chainDescriptors: {
        7082400: {
            name: "COTI Testnet",
            blockExplorers: {
                blockscout: {
                    name: "Cotiscan",
                    url: "https://testnet.cotiscan.io",
                    apiUrl: "https://testnet.cotiscan.io/api",
                },
            },
        },
    },
    solidity:
        scope === "pod"
            ? {
                  compilers: [
                      {
                          version: "0.8.26",
                          settings: {
                              optimizer: { enabled: true, runs: 200 },
                          },
                      },
                  ],
              }
            : {
                  compilers: [
                      {
                          version: "0.8.19",
                          settings: {
                              optimizer: { enabled: true, runs: 200 },
                          },
                      },
                  ],
              },
    networks: {
        cotiTestnet: {
            type: "http",
            url: cotiRpc,
            chainId: 7082400,
            accounts: [
                process.env.DEPLOYER_PRIVATE_KEY,
                getPrivateKey('VITE_ALICE_PK'),
                getPrivateKey('VITE_BOB_PK')
            ].filter(Boolean),
            timeout: 120000,
            gas: 3000000,
            gasPrice: 10000000000,
        },
        sepolia: {
            type: "http",
            chainType: "l1",
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [
                process.env.DEPLOYER_PRIVATE_KEY,
                getPrivateKey('VITE_ALICE_PK'),
                getPrivateKey('VITE_BOB_PK')
            ].filter(Boolean),
        },
        avalancheFuji: {
            type: "http",
            chainType: "l1",
            url:
                process.env.AVALANCHE_FUJI_RPC_URL ||
                process.env.VITE_AVALANCHE_FUJI_RPC_URL ||
                "https://api.avax-test.network/ext/bc/C/rpc",
            chainId: 43113,
            accounts: [
                process.env.DEPLOYER_PRIVATE_KEY,
                getPrivateKey('VITE_ALICE_PK'),
                getPrivateKey('VITE_BOB_PK')
            ].filter(Boolean),
        },
    },
    sourcify: {
        enabled: false,
    },
    verify: {
        etherscan: {
            apiKey: process.env.ETHERSCAN_API_KEY,
            enabled: true,
        },
    },
    paths: {
        sources: scope === "pod" ? "./contracts/pod" : "./contracts/coti",
        tests: "./test",
        cache: scope === "pod" ? "./cache-pod" : "./cache",
        artifacts: scope === "pod" ? "./artifacts-pod" : "./artifacts",
    },
};
