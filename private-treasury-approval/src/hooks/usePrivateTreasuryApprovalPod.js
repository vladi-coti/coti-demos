import { useMemo } from "react";
import { ethers } from "ethers";
import {
  BATCH_PROCESS_REQUESTS_SELECTOR,
  ZERO_BYTES32,
  buildContract,
  createCotiWallet,
  createEvmWallet,
  formatTxResult,
  getEnvValue,
  isMissingAddress,
  parseAddressList,
  parseWei,
} from "./usePrivateTreasuryApprovalShared";

export function usePrivateTreasuryApprovalPod() {
  const sourceRpcUrl = getEnvValue("VITE_POD_SOURCE_RPC_URL", "VITE_SOURCE_RPC_URL");
  const cotiRpcUrl = getEnvValue("VITE_POD_COTI_RPC_URL", "VITE_COTI_RPC_URL") || "https://testnet.coti.io/rpc";
  const sourceContractAddress = getEnvValue("VITE_POD_SOURCE_CONTRACT_ADDRESS", "VITE_SOURCE_CONTRACT_ADDRESS");
  const cotiContractAddress = getEnvValue("VITE_POD_COTI_CONTRACT_ADDRESS", "VITE_COTI_CONTRACT_ADDRESS");
  const cotiInboxAddress = getEnvValue("VITE_POD_COTI_INBOX_ADDRESS", "VITE_COTI_INBOX_ADDRESS");
  const podEncryptionUrl = getEnvValue("VITE_POD_ENCRYPTION_URL").trim();

  const ownerPk = getEnvValue("VITE_POD_OWNER_PK", "VITE_OWNER_PK");
  const ownerAesKey = getEnvValue("VITE_POD_OWNER_AES_KEY", "VITE_OWNER_AES_KEY");
  const approverPk = getEnvValue("VITE_POD_APPROVER_PK", "VITE_APPROVER_PK");
  const approverAesKey = getEnvValue("VITE_POD_APPROVER_AES_KEY", "VITE_APPROVER_AES_KEY");

  const callbackFeeWei = parseWei(getEnvValue("VITE_POD_CALLBACK_FEE_WEI", "VITE_CALLBACK_FEE_WEI"), "1000000000000000");
  const createTotalFeeWei = parseWei(
    getEnvValue("VITE_POD_CREATE_TOTAL_FEE_WEI", "VITE_CREATE_TOTAL_FEE_WEI"),
    "3000000000000000"
  );
  const approvalTotalFeeWei = parseWei(
    getEnvValue("VITE_POD_APPROVAL_TOTAL_FEE_WEI", "VITE_APPROVAL_TOTAL_FEE_WEI"),
    "3000000000000000"
  );
  const finalizeTotalFeeWei = parseWei(
    getEnvValue("VITE_POD_FINALIZE_TOTAL_FEE_WEI", "VITE_FINALIZE_TOTAL_FEE_WEI"),
    "3000000000000000"
  );

  const sourceProvider = useMemo(() => {
    if (!sourceRpcUrl) return null;
    return new ethers.JsonRpcProvider(sourceRpcUrl);
  }, [sourceRpcUrl]);

  const cotiProvider = useMemo(() => new ethers.JsonRpcProvider(cotiRpcUrl), [cotiRpcUrl]);

  const wallets = useMemo(
    () => ({
      ownerSourceWallet: createEvmWallet(ownerPk, sourceProvider),
      ownerCotiWallet: createCotiWallet(ownerPk, ownerAesKey, cotiProvider),
      approverSourceWallet: createEvmWallet(approverPk, sourceProvider),
      approverCotiWallet: createCotiWallet(approverPk, approverAesKey, cotiProvider),
    }),
    [approverAesKey, approverPk, cotiProvider, ownerAesKey, ownerPk, sourceProvider]
  );

  const missingConfig = [
    !sourceRpcUrl ? "VITE_POD_SOURCE_RPC_URL" : null,
    isMissingAddress(sourceContractAddress) ? "VITE_POD_SOURCE_CONTRACT_ADDRESS" : null,
    isMissingAddress(cotiContractAddress) ? "VITE_POD_COTI_CONTRACT_ADDRESS" : null,
    !podEncryptionUrl && isMissingAddress(cotiInboxAddress) ? "VITE_POD_COTI_INBOX_ADDRESS" : null,
    !wallets.ownerSourceWallet ? "VITE_OWNER_PK" : null,
    !wallets.ownerCotiWallet ? "VITE_OWNER_AES_KEY" : null,
    !wallets.approverSourceWallet ? "VITE_APPROVER_PK" : null,
    !wallets.approverCotiWallet ? "VITE_APPROVER_AES_KEY" : null,
  ].filter(Boolean);

  const getContract = (runner) => buildContract(sourceContractAddress, runner || sourceProvider, "Sepolia treasury contract");

  const getReadContract = () => getContract(sourceProvider);

  const getAddresses = () => ({
    owner: wallets.ownerSourceWallet?.address || "",
    approver: wallets.approverSourceWallet?.address || "",
  });

  const getExplorerLink = (hash) => `https://sepolia.etherscan.io/tx/${hash}`;
  const getAddressLink = (address, network = "primary") =>
    network === "coti" || network === "secondary"
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
      throw new Error("Owner Sepolia wallet is not configured");
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
      throw new Error("Owner Sepolia wallet is not configured");
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
      throw new Error("Owner Sepolia wallet is not configured");
    }

    const contract = getContract(wallets.ownerSourceWallet);
    return formatTxResult(
      contract.registerProposalRemote(BigInt(proposalId), callbackFeeWei, {
        value: BigInt(totalFeeWei),
        gasLimit: 1_200_000,
      })
    );
  };

  const encryptApprovalVote = async (support) => {
    const clearValue = support ? "1" : "0";

    if (podEncryptionUrl) {
      const response = await fetch(`${podEncryptionUrl.replace(/\/$/, "")}/buildEncryptedInputs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataType: "bool",
          value: clearValue,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hosted PoD encryption failed: ${errorText}`);
      }

      const payload = await response.json();
      if (payload?.ciphertext == null || payload?.signature == null) {
        throw new Error("Hosted PoD encryption response is missing ciphertext or signature");
      }

      const ciphertext =
        typeof payload.ciphertext === "string" && payload.ciphertext.startsWith("0x")
          ? BigInt(payload.ciphertext)
          : BigInt(payload.ciphertext);
      const signature = String(payload.signature).startsWith("0x")
        ? String(payload.signature)
        : `0x${String(payload.signature)}`;

      return {
        ciphertext,
        signature,
      };
    }

    if (isMissingAddress(cotiInboxAddress)) {
      throw new Error("VITE_POD_COTI_INBOX_ADDRESS is missing or invalid");
    }

    return wallets.approverCotiWallet.encryptValue(
      BigInt(clearValue),
      cotiInboxAddress,
      BATCH_PROCESS_REQUESTS_SELECTOR
    );
  };

  const castApproval = async (proposalId, support, totalFeeWei = approvalTotalFeeWei) => {
    if (!wallets.approverSourceWallet || !wallets.approverCotiWallet) {
      throw new Error("Approver wallets are not configured");
    }

    const encryptedVote = await encryptApprovalVote(support);

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
      throw new Error("Owner Sepolia wallet is not configured");
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
      throw new Error("Owner Sepolia wallet is not configured");
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
      mode: "pod",
      modeLabel: "Sepolia + PoD",
      modeDescription:
        "Transactions run on Sepolia while private tallying and callback delivery run through COTI Testnet via inbox relay.",
      encryptionMode: podEncryptionUrl ? "hosted" : "wallet",
      primaryChainLabel: "Sepolia",
      privacyChainLabel: "COTI Testnet",
      primaryContractLabel: "Sepolia Treasury Contract",
      secondaryContractLabel: "COTI Tally Contract",
      primaryContractAddress: sourceContractAddress,
      secondaryContractAddress: cotiContractAddress,
      primaryExplorer: "https://sepolia.etherscan.io",
      secondaryExplorer: "https://testnet.cotiscan.io",
      supportsRemoteRegistration: true,
      supportsPendingCallbacks: true,
      requiresRelay: true,
      supportsCrossChainFees: true,
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
      recipient: getEnvValue("VITE_POD_DEFAULT_RECIPIENT", "VITE_DEFAULT_RECIPIENT"),
      approvers: getEnvValue("VITE_POD_DEFAULT_APPROVERS", "VITE_DEFAULT_APPROVERS"),
      descriptionHash:
        getEnvValue("VITE_POD_DEFAULT_DESCRIPTION_HASH", "VITE_DEFAULT_DESCRIPTION_HASH") || `0x${"1".repeat(64)}`,
      zeroRequestId: ZERO_BYTES32,
    },
  };
}
