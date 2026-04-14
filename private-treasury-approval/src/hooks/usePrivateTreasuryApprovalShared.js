import { ethers } from "ethers";
import { Wallet as CotiWallet } from "@coti-io/coti-ethers";

export const TREASURY_ABI = [
  "function owner() view returns (address)",
  "function nextProposalId() view returns (uint256)",
  "function proposals(uint256) view returns (address recipient,address asset,uint256 amount,bytes32 descriptionHash,uint64 deadline,uint64 threshold,bool exists,bool registered,bool finalized,bool approved,bool executed)",
  "function isEligibleApprover(uint256,address) view returns (bool)",
  "function pendingApprovalRequestIdOf(uint256,address) view returns (bytes32)",
  "function pendingApprovalCountOf(uint256) view returns (uint256)",
  "function pendingRegisterRequestIdOf(uint256) view returns (bytes32)",
  "function pendingFinalizeRequestIdOf(uint256) view returns (bytes32)",
  "function recordedVoteReceiptOf(uint256,address) view returns (uint256)",
  "function encryptedYesVotesOf(uint256) view returns (uint256)",
  "function encryptedNoVotesOf(uint256) view returns (uint256)",
  "function createProposal(address,address,uint256,bytes32,uint64,uint64,address[],uint256) payable returns (uint256,bytes32)",
  "function registerProposalRemote(uint256,uint256) payable returns (bytes32)",
  "function castApproval(uint256,tuple(uint256 ciphertext, bytes signature),uint256) payable returns (bytes32)",
  "function finalizeProposal(uint256,uint256) payable returns (bytes32)",
  "function executeProposal(uint256) external",
];

const BATCH_PROCESS_REQUESTS_SIGNATURE =
  "batchProcessRequests(uint256,(bytes32,address,address,(bytes4,bytes,bytes8[],bytes32[]),bytes4,bytes4,bool,bytes32,uint256,uint256)[])";

export const BATCH_PROCESS_REQUESTS_SELECTOR = ethers.id(BATCH_PROCESS_REQUESTS_SIGNATURE).slice(0, 10);
export const NATIVE_CAST_APPROVAL_SELECTOR = new ethers.Interface(TREASURY_ABI).getFunction("castApproval").selector;
export const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

export const getEnvValue = (...keys) => {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

export const parseWei = (value, fallback = "0") => {
  const normalized = String(value ?? fallback).trim() || fallback;
  return BigInt(normalized);
};

export const with0x = (value) => {
  if (!value) return "";
  return value.startsWith("0x") ? value : `0x${value}`;
};

export const parseAddressList = (raw) =>
  String(raw || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const isMissingAddress = (value) => !/^0x[a-fA-F0-9]{40}$/.test(String(value || ""));

export const createCotiWallet = (privateKey, aesKey, provider) => {
  if (!privateKey || !aesKey) return null;
  const wallet = new CotiWallet(with0x(privateKey), provider);
  wallet.setUserOnboardInfo({ aesKey });
  return wallet;
};

export const createEvmWallet = (privateKey, provider) => {
  if (!privateKey) return null;
  return new ethers.Wallet(with0x(privateKey), provider);
};

export const formatTxResult = async (txPromise) => {
  const tx = await txPromise;
  await tx.wait();
  return {
    hash: tx.hash,
  };
};

export const buildContract = (contractAddress, runner, label = "Contract") => {
  if (isMissingAddress(contractAddress)) {
    throw new Error(`${label} address is missing or invalid`);
  }
  if (!runner) {
    throw new Error(`${label} runner is not configured`);
  }
  return new ethers.Contract(contractAddress, TREASURY_ABI, runner);
};
