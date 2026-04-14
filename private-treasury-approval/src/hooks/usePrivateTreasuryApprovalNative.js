import { useMemo } from "react";
import { ethers } from "ethers";
import {
  NATIVE_CAST_APPROVAL_SELECTOR,
  ZERO_BYTES32,
  buildContract,
  createCotiWallet,
  formatTxResult,
  getEnvValue,
  isMissingAddress,
  parseAddressList,
} from "./usePrivateTreasuryApprovalShared";

export function usePrivateTreasuryApprovalNative() {
  const cotiRpcUrl = getEnvValue("VITE_NATIVE_COTI_RPC_URL", "VITE_COTI_RPC_URL") || "https://testnet.coti.io/rpc";
  const contractAddress = getEnvValue("VITE_NATIVE_COTI_CONTRACT_ADDRESS", "VITE_NATIVE_CONTRACT_ADDRESS");

  const ownerPk = getEnvValue("VITE_NATIVE_OWNER_PK", "VITE_OWNER_PK");
  const ownerAesKey = getEnvValue("VITE_NATIVE_OWNER_AES_KEY", "VITE_OWNER_AES_KEY");
  const approverPk = getEnvValue("VITE_NATIVE_APPROVER_PK", "VITE_APPROVER_PK");
  const approverAesKey = getEnvValue("VITE_NATIVE_APPROVER_AES_KEY", "VITE_APPROVER_AES_KEY");

  const cotiProvider = useMemo(() => new ethers.JsonRpcProvider(cotiRpcUrl), [cotiRpcUrl]);

  const wallets = useMemo(
    () => ({
      ownerWallet: createCotiWallet(ownerPk, ownerAesKey, cotiProvider),
      approverWallet: createCotiWallet(approverPk, approverAesKey, cotiProvider),
    }),
    [approverAesKey, approverPk, cotiProvider, ownerAesKey, ownerPk]
  );

  const missingConfig = [
    !cotiRpcUrl ? "VITE_NATIVE_COTI_RPC_URL" : null,
    isMissingAddress(contractAddress) ? "VITE_NATIVE_COTI_CONTRACT_ADDRESS" : null,
    !wallets.ownerWallet ? "VITE_OWNER_PK / VITE_OWNER_AES_KEY" : null,
    !wallets.approverWallet ? "VITE_APPROVER_PK / VITE_APPROVER_AES_KEY" : null,
  ].filter(Boolean);

  const getContract = (runner) => buildContract(contractAddress, runner || cotiProvider, "COTI treasury contract");

  const getReadContract = () => getContract(cotiProvider);

  const getAddresses = () => ({
    owner: wallets.ownerWallet?.address || "",
    approver: wallets.approverWallet?.address || "",
  });

  const getExplorerLink = (hash) => `https://testnet.cotiscan.io/tx/${hash}`;
  const getAddressLink = (address) => `https://testnet.cotiscan.io/address/${address}`;

  const getTreasuryBalance = async () => {
    if (!cotiProvider || isMissingAddress(contractAddress)) return 0n;
    return cotiProvider.getBalance(contractAddress);
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

    const approverAddress = wallets.approverWallet?.address || ethers.ZeroAddress;
    const approverEligible =
      approverAddress === ethers.ZeroAddress ? false : await contract.isEligibleApprover(proposalId, approverAddress);

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
      pendingRegister: ZERO_BYTES32,
      pendingFinalize: ZERO_BYTES32,
      pendingApprovalCount: 0n,
      approverPendingApproval: ZERO_BYTES32,
      approverEligible,
    };
  };

  const fundTreasury = async (amountEth) => {
    if (!wallets.ownerWallet) {
      throw new Error("Owner COTI wallet is not configured");
    }
    if (!amountEth || Number(amountEth) <= 0) {
      throw new Error("Funding amount must be greater than zero");
    }

    return formatTxResult(
      wallets.ownerWallet.sendTransaction({
        to: contractAddress,
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
  }) => {
    if (!wallets.ownerWallet) {
      throw new Error("Owner COTI wallet is not configured");
    }

    const contract = getContract(wallets.ownerWallet);
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
      0,
      {
        gasLimit: 1_500_000,
      }
    );

    await tx.wait();
    return {
      hash: tx.hash,
      proposalId: proposalId.toString(),
    };
  };

  const registerProposalRemote = async () => {
    throw new Error("Native COTI mode does not use remote registration.");
  };

  const castApproval = async (proposalId, support) => {
    if (!wallets.approverWallet) {
      throw new Error("Approver COTI wallet is not configured");
    }
    if (isMissingAddress(contractAddress)) {
      throw new Error("VITE_NATIVE_COTI_CONTRACT_ADDRESS is missing or invalid");
    }

    const encryptedVote = await wallets.approverWallet.encryptValue(
      BigInt(support ? 1 : 0),
      contractAddress,
      NATIVE_CAST_APPROVAL_SELECTOR
    );

    const contract = getContract(wallets.approverWallet);
    return formatTxResult(
      contract.castApproval(BigInt(proposalId), encryptedVote, 0, {
        gasLimit: 1_000_000,
      })
    );
  };

  const finalizeProposal = async (proposalId) => {
    if (!wallets.ownerWallet) {
      throw new Error("Owner COTI wallet is not configured");
    }

    const contract = getContract(wallets.ownerWallet);
    return formatTxResult(
      contract.finalizeProposal(BigInt(proposalId), 0, {
        gasLimit: 1_000_000,
      })
    );
  };

  const executeProposal = async (proposalId) => {
    if (!wallets.ownerWallet) {
      throw new Error("Owner COTI wallet is not configured");
    }

    const contract = getContract(wallets.ownerWallet);
    return formatTxResult(
      contract.executeProposal(BigInt(proposalId), {
        gasLimit: 250000,
      })
    );
  };

  const decryptApproverReceipt = async (proposalId) => {
    if (!wallets.approverWallet) {
      throw new Error("Approver COTI wallet is not configured");
    }

    const contract = getContract(cotiProvider);
    const ciphertext = await contract.recordedVoteReceiptOf(BigInt(proposalId), wallets.approverWallet.address);
    if (BigInt(ciphertext) === 0n) {
      return null;
    }

    const clearValue = await wallets.approverWallet.decryptValue(ciphertext);
    return {
      raw: clearValue,
      support: clearValue === 1n,
    };
  };

  const decryptTallies = async (proposalId) => {
    if (!wallets.ownerWallet) {
      throw new Error("Owner COTI wallet is not configured");
    }

    const contract = getReadContract();
    const [yesCiphertext, noCiphertext] = await Promise.all([
      contract.encryptedYesVotesOf(BigInt(proposalId)),
      contract.encryptedNoVotesOf(BigInt(proposalId)),
    ]);

    if (BigInt(yesCiphertext) === 0n && BigInt(noCiphertext) === 0n) {
      return null;
    }

    const [yesVotes, noVotes] = await Promise.all([
      wallets.ownerWallet.decryptValue(yesCiphertext),
      wallets.ownerWallet.decryptValue(noCiphertext),
    ]);

    return {
      yesVotes,
      noVotes,
    };
  };

  return {
    config: {
      mode: "native",
      modeLabel: "Native COTI",
      modeDescription:
        "Transactions, encrypted approvals, and tally decryption all stay on COTI Testnet with no inbox round-trip.",
      primaryChainLabel: "COTI Testnet",
      privacyChainLabel: "COTI Testnet",
      primaryContractLabel: "COTI Treasury Contract",
      secondaryContractLabel: "",
      primaryContractAddress: contractAddress,
      secondaryContractAddress: "",
      primaryExplorer: "https://testnet.cotiscan.io",
      secondaryExplorer: "",
      supportsRemoteRegistration: false,
      supportsPendingCallbacks: false,
      requiresRelay: false,
      supportsCrossChainFees: false,
      callbackFeeWei: 0n,
      createTotalFeeWei: 0n,
      approvalTotalFeeWei: 0n,
      finalizeTotalFeeWei: 0n,
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
      recipient: getEnvValue("VITE_NATIVE_DEFAULT_RECIPIENT", "VITE_DEFAULT_RECIPIENT"),
      approvers: getEnvValue("VITE_NATIVE_DEFAULT_APPROVERS", "VITE_DEFAULT_APPROVERS"),
      descriptionHash:
        getEnvValue("VITE_NATIVE_DEFAULT_DESCRIPTION_HASH", "VITE_DEFAULT_DESCRIPTION_HASH") ||
        `0x${"1".repeat(64)}`,
      zeroRequestId: ZERO_BYTES32,
    },
  };
}
