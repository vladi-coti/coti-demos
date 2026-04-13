import { useMemo } from "react";
import { ethers } from "ethers";
import { Wallet as CotiWallet } from "@coti-io/coti-ethers";

const BATCH_PROCESS_REQUESTS_SIGNATURE =
  "batchProcessRequests(uint256,(bytes32,address,address,(bytes4,bytes,bytes8[],bytes32[]),bytes4,bytes4,bool,bytes32,uint256,uint256)[])";
const BATCH_PROCESS_REQUESTS_SELECTOR = ethers.id(BATCH_PROCESS_REQUESTS_SIGNATURE).slice(0, 10);

const SOURCE_ABI = [
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

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;

const parseWei = (value, fallback = "0") => {
  const normalized = String(value ?? fallback).trim() || fallback;
  return BigInt(normalized);
};

const with0x = (value) => {
  if (!value) return "";
  return value.startsWith("0x") ? value : `0x${value}`;
};

const parseAddressList = (raw) =>
  String(raw || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const isMissingAddress = (value) => !/^0x[a-fA-F0-9]{40}$/.test(String(value || ""));

const createCotiWallet = (privateKey, aesKey, provider) => {
  if (!privateKey || !aesKey) return null;
  const wallet = new CotiWallet(with0x(privateKey), provider);
  wallet.setUserOnboardInfo({ aesKey });
  return wallet;
};

const createSourceWallet = (privateKey, provider) => {
  if (!privateKey) return null;
  return new ethers.Wallet(with0x(privateKey), provider);
};

const formatTxResult = async (txPromise) => {
  const tx = await txPromise;
  await tx.wait();
  return {
    hash: tx.hash,
  };
};

export function usePrivateTreasuryApproval() {
  const sourceRpcUrl = import.meta.env.VITE_SOURCE_RPC_URL;
  const cotiRpcUrl = import.meta.env.VITE_COTI_RPC_URL || "https://testnet.coti.io/rpc";
  const sourceContractAddress = import.meta.env.VITE_SOURCE_CONTRACT_ADDRESS;
  const cotiContractAddress = import.meta.env.VITE_COTI_CONTRACT_ADDRESS;
  const cotiInboxAddress = import.meta.env.VITE_COTI_INBOX_ADDRESS;

  const callbackFeeWei = parseWei(import.meta.env.VITE_CALLBACK_FEE_WEI, "1000000000000000");
  const createTotalFeeWei = parseWei(import.meta.env.VITE_CREATE_TOTAL_FEE_WEI, "3000000000000000");
  const approvalTotalFeeWei = parseWei(import.meta.env.VITE_APPROVAL_TOTAL_FEE_WEI, "3000000000000000");
  const finalizeTotalFeeWei = parseWei(import.meta.env.VITE_FINALIZE_TOTAL_FEE_WEI, "3000000000000000");

  const sourceProvider = useMemo(() => {
    if (!sourceRpcUrl) return null;
    return new ethers.JsonRpcProvider(sourceRpcUrl);
  }, [sourceRpcUrl]);

  const cotiProvider = useMemo(() => new ethers.JsonRpcProvider(cotiRpcUrl), [cotiRpcUrl]);

  const wallets = useMemo(() => {
    const ownerPk = import.meta.env.VITE_OWNER_PK;
    const ownerAesKey = import.meta.env.VITE_OWNER_AES_KEY;
    const approverPk = import.meta.env.VITE_APPROVER_PK;
    const approverAesKey = import.meta.env.VITE_APPROVER_AES_KEY;

    return {
      ownerSourceWallet: createSourceWallet(ownerPk, sourceProvider),
      ownerCotiWallet: createCotiWallet(ownerPk, ownerAesKey, cotiProvider),
      approverSourceWallet: createSourceWallet(approverPk, sourceProvider),
      approverCotiWallet: createCotiWallet(approverPk, approverAesKey, cotiProvider),
    };
  }, [cotiProvider, sourceProvider]);

  const missingConfig = [
    !sourceRpcUrl ? "VITE_SOURCE_RPC_URL" : null,
    isMissingAddress(sourceContractAddress) ? "VITE_SOURCE_CONTRACT_ADDRESS" : null,
    isMissingAddress(cotiInboxAddress) ? "VITE_COTI_INBOX_ADDRESS" : null,
    !wallets.ownerSourceWallet ? "VITE_OWNER_PK" : null,
    !wallets.ownerCotiWallet ? "VITE_OWNER_AES_KEY" : null,
    !wallets.approverSourceWallet ? "VITE_APPROVER_PK" : null,
    !wallets.approverCotiWallet ? "VITE_APPROVER_AES_KEY" : null,
  ].filter(Boolean);

  const getContract = (runner) => {
    if (isMissingAddress(sourceContractAddress)) {
      throw new Error("VITE_SOURCE_CONTRACT_ADDRESS is missing or invalid");
    }
    const resolvedRunner = runner || sourceProvider;
    if (!resolvedRunner) {
      throw new Error("Source provider is not configured");
    }
    return new ethers.Contract(sourceContractAddress, SOURCE_ABI, resolvedRunner);
  };

  const getReadContract = () => getContract(sourceProvider);

  const getAddresses = () => ({
    owner: wallets.ownerSourceWallet?.address || "",
    approver: wallets.approverSourceWallet?.address || "",
  });

  const getExplorerLink = (hash) => `https://sepolia.etherscan.io/tx/${hash}`;
  const getAddressLink = (address, network = "source") =>
    network === "coti"
      ? `https://testnet.cotiscan.io/address/${address}`
      : `https://sepolia.etherscan.io/address/${address}`;

  const getTreasuryBalance = async () => {
    if (!sourceProvider || isMissingAddress(sourceContractAddress)) return 0n;
    return sourceProvider.getBalance(sourceContractAddress);
  };

  const getProposalSnapshot = async (proposalIdValue) => {
    const proposalId = BigInt(proposalIdValue);
    const contract = getReadContract();
    const [proposal, ownerAddress, treasuryBalance] = await Promise.all([
      contract.proposals(proposalId),
      contract.owner(),
      getTreasuryBalance(),
    ]);

    if (!proposal.exists) {
      return null;
    }

    const approverAddress = wallets.approverSourceWallet?.address || ethers.ZeroAddress;
    const [pendingRegister, pendingFinalize, pendingApprovalCount, approverPendingApproval, approverEligible] =
      await Promise.all([
        contract.pendingRegisterRequestIdOf(proposalId),
        contract.pendingFinalizeRequestIdOf(proposalId),
        contract.pendingApprovalCountOf(proposalId),
        contract.pendingApprovalRequestIdOf(proposalId, approverAddress),
        approverAddress === ethers.ZeroAddress
          ? Promise.resolve(false)
          : contract.isEligibleApprover(proposalId, approverAddress),
      ]);

    return {
      proposalId,
      ownerAddress,
      treasuryBalance,
      recipient: proposal.recipient,
      asset: proposal.asset,
      amount: proposal.amount,
      descriptionHash: proposal.descriptionHash,
      deadline: BigInt(proposal.deadline),
      threshold: BigInt(proposal.threshold),
      exists: proposal.exists,
      registered: proposal.registered,
      finalized: proposal.finalized,
      approved: proposal.approved,
      executed: proposal.executed,
      pendingRegister,
      pendingFinalize,
      pendingApprovalCount,
      approverPendingApproval,
      approverEligible,
    };
  };

  const fundTreasury = async (amountEth) => {
    if (!wallets.ownerSourceWallet) {
      throw new Error("Owner source wallet is not configured");
    }
    if (!amountEth || Number(amountEth) <= 0) {
      throw new Error("Funding amount must be greater than zero");
    }

    return formatTxResult(
      wallets.ownerSourceWallet.sendTransaction({
        to: sourceContractAddress,
        value: ethers.parseEther(String(amountEth)),
      })
    );
  };

  const createProposal = async ({
    recipient,
    amountEth,
    descriptionHash,
    minutesUntilDeadline,
    threshold,
    approvers,
    totalFeeWei = createTotalFeeWei,
  }) => {
    if (!wallets.ownerSourceWallet) {
      throw new Error("Owner source wallet is not configured");
    }

    const contract = getContract(wallets.ownerSourceWallet);
    const proposalId = await contract.nextProposalId();
    const approverList = parseAddressList(approvers);

    if (approverList.length === 0) {
      throw new Error("At least one approver is required");
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(minutesUntilDeadline || 10) * 60);
    const tx = await contract.createProposal(
      recipient,
      ethers.ZeroAddress,
      ethers.parseEther(String(amountEth)),
      descriptionHash,
      deadline,
      BigInt(threshold),
      approverList,
      callbackFeeWei,
      {
        value: BigInt(totalFeeWei),
        gasLimit: 1_800_000,
      }
    );

    await tx.wait();
    return {
      hash: tx.hash,
      proposalId: proposalId.toString(),
    };
  };

  const registerProposalRemote = async (proposalId, totalFeeWei = createTotalFeeWei) => {
    if (!wallets.ownerSourceWallet) {
      throw new Error("Owner source wallet is not configured");
    }

    const contract = getContract(wallets.ownerSourceWallet);
    return formatTxResult(
      contract.registerProposalRemote(BigInt(proposalId), callbackFeeWei, {
        value: BigInt(totalFeeWei),
        gasLimit: 1_200_000,
      })
    );
  };

  const castApproval = async (proposalId, support, totalFeeWei = approvalTotalFeeWei) => {
    if (!wallets.approverSourceWallet || !wallets.approverCotiWallet) {
      throw new Error("Approver wallets are not configured");
    }
    if (isMissingAddress(cotiInboxAddress)) {
      throw new Error("VITE_COTI_INBOX_ADDRESS is missing or invalid");
    }

    const encryptedVote = await wallets.approverCotiWallet.encryptValue(
      BigInt(support ? 1 : 0),
      cotiInboxAddress,
      BATCH_PROCESS_REQUESTS_SELECTOR
    );

    const contract = getContract(wallets.approverSourceWallet);
    return formatTxResult(
      contract.castApproval(BigInt(proposalId), encryptedVote, callbackFeeWei, {
        value: BigInt(totalFeeWei),
        gasLimit: 1_600_000,
      })
    );
  };

  const finalizeProposal = async (proposalId, totalFeeWei = finalizeTotalFeeWei) => {
    if (!wallets.ownerSourceWallet) {
      throw new Error("Owner source wallet is not configured");
    }

    const contract = getContract(wallets.ownerSourceWallet);
    return formatTxResult(
      contract.finalizeProposal(BigInt(proposalId), callbackFeeWei, {
        value: BigInt(totalFeeWei),
        gasLimit: 1_500_000,
      })
    );
  };

  const executeProposal = async (proposalId) => {
    if (!wallets.ownerSourceWallet) {
      throw new Error("Owner source wallet is not configured");
    }

    const contract = getContract(wallets.ownerSourceWallet);
    return formatTxResult(
      contract.executeProposal(BigInt(proposalId), {
        gasLimit: 250000,
      })
    );
  };

  const decryptApproverReceipt = async (proposalId) => {
    if (!wallets.approverSourceWallet || !wallets.approverCotiWallet) {
      throw new Error("Approver wallets are not configured");
    }

    const contract = getContract(wallets.approverSourceWallet);
    const ciphertext = await contract.recordedVoteReceiptOf(BigInt(proposalId), wallets.approverSourceWallet.address);
    if (BigInt(ciphertext) === 0n) {
      return null;
    }

    const clearValue = await wallets.approverCotiWallet.decryptValue(ciphertext);
    return {
      raw: clearValue,
      support: clearValue === 1n,
    };
  };

  const decryptTallies = async (proposalId) => {
    if (!wallets.ownerSourceWallet || !wallets.ownerCotiWallet) {
      throw new Error("Owner wallets are not configured");
    }

    const contract = getContract(wallets.ownerSourceWallet);
    const [yesCiphertext, noCiphertext] = await Promise.all([
      contract.encryptedYesVotesOf(BigInt(proposalId)),
      contract.encryptedNoVotesOf(BigInt(proposalId)),
    ]);

    if (BigInt(yesCiphertext) === 0n && BigInt(noCiphertext) === 0n) {
      return null;
    }

    const [yesVotes, noVotes] = await Promise.all([
      wallets.ownerCotiWallet.decryptValue(yesCiphertext),
      wallets.ownerCotiWallet.decryptValue(noCiphertext),
    ]);

    return {
      yesVotes,
      noVotes,
    };
  };

  return {
    config: {
      sourceRpcUrl,
      cotiRpcUrl,
      sourceContractAddress,
      cotiContractAddress,
      cotiInboxAddress,
      callbackFeeWei,
      createTotalFeeWei,
      approvalTotalFeeWei,
      finalizeTotalFeeWei,
      missingConfig,
    },
    wallets,
    getAddresses,
    getExplorerLink,
    getAddressLink,
    getTreasuryBalance,
    getProposalSnapshot,
    fundTreasury,
    createProposal,
    registerProposalRemote,
    castApproval,
    finalizeProposal,
    executeProposal,
    decryptApproverReceipt,
    decryptTallies,
    defaults: {
      recipient: import.meta.env.VITE_DEFAULT_RECIPIENT || "",
      approvers: import.meta.env.VITE_DEFAULT_APPROVERS || "",
      descriptionHash:
        import.meta.env.VITE_DEFAULT_DESCRIPTION_HASH || `0x${"1".repeat(64)}`,
      zeroRequestId: ZERO_BYTES32,
    },
  };
}
