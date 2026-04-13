import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { usePrivateTreasuryApproval } from "../hooks/usePrivateTreasuryApproval";
import {
  AppContainer,
  Badge,
  Button,
  ButtonRow,
  Card,
  CardGrid,
  CardTitle,
  Divider,
  Field,
  FieldRow,
  HelperText,
  Input,
  Label,
  Link,
  Metric,
  MetricLabel,
  MetricList,
  MetricValue,
  Mono,
  Notice,
  Section,
  Subtitle,
  TextArea,
  StepArrow,
  StepCard,
  StepFlow,
  StepHeader,
  StepNumber,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineText,
  TimelineTitle,
  Title,
} from "../components/styles";

const emptyNotice = { variant: "info", message: "", txHash: "" };

const shorten = (value) => {
  if (!value || value.length < 12) return value || "Not configured";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const formatEth = (value) => {
  try {
    return `${Number(ethers.formatEther(BigInt(value || 0n))).toFixed(4)} ETH`;
  } catch {
    return "0 ETH";
  }
};

const formatTimestamp = (value) => {
  if (!value) return "Unknown";
  return new Date(Number(value) * 1000).toLocaleString();
};

const isZeroRequestId = (value, zeroRequestId) => !value || value === zeroRequestId;

const getStageTone = (snapshot, zeroRequestId) => {
  if (!snapshot) return "info";
  if (snapshot.executed) return "success";
  if (snapshot.finalized && snapshot.approved) return "success";
  if (snapshot.finalized && !snapshot.approved) return "error";
  if (!isZeroRequestId(snapshot.pendingFinalize, zeroRequestId)) return "warning";
  if (snapshot.pendingApprovalCount > 0n) return "warning";
  if (snapshot.registered) return "info";
  if (!isZeroRequestId(snapshot.pendingRegister, zeroRequestId)) return "warning";
  return "info";
};

const hasPendingActivity = (snapshot, zeroRequestId) => {
  if (!snapshot) return false;
  return (
    !isZeroRequestId(snapshot.pendingRegister, zeroRequestId) ||
    !isZeroRequestId(snapshot.pendingFinalize, zeroRequestId) ||
    !isZeroRequestId(snapshot.approverPendingApproval, zeroRequestId) ||
    snapshot.pendingApprovalCount > 0n
  );
};

const isProposalExpired = (snapshot) => {
  if (!snapshot || snapshot.finalized) return false;
  const now = Math.floor(Date.now() / 1000);
  return Number(snapshot.deadline) <= now;
};

const isDeadUnregisteredProposal = (snapshot) => {
  if (!snapshot) return false;
  return isProposalExpired(snapshot) && !snapshot.registered;
};

const buildTimeline = (snapshot, zeroRequestId) => {
  if (!snapshot) return [];

  const voteWindowClosed = isProposalExpired(snapshot);

  return [
    {
      title: "Proposal created",
      tone: "success",
      status: "Done",
      text: `Proposal #${snapshot.proposalId.toString()} targets ${shorten(snapshot.recipient)} for ${formatEth(snapshot.amount)}.`,
    },
    {
      title: snapshot.registered ? "Remote registration complete" : "Remote registration",
      tone: snapshot.registered ? "success" : !isZeroRequestId(snapshot.pendingRegister, zeroRequestId) ? "warning" : "info",
      status: snapshot.registered ? "Done" : !isZeroRequestId(snapshot.pendingRegister, zeroRequestId) ? "Pending" : "Next",
      text: snapshot.registered
        ? "The COTI-side tally contract knows this proposal and voting can proceed."
        : !isZeroRequestId(snapshot.pendingRegister, zeroRequestId)
          ? "Registration transaction was sent. Wait for the cross-chain callback, then refresh."
          : "Registration is not yet confirmed. Retry only if the callback is clearly stuck.",
    },
    {
      title: "Private approvals",
      tone:
        snapshot.pendingApprovalCount > 0n
          ? "warning"
          : snapshot.finalized
            ? "success"
            : snapshot.approverEligible
              ? "info"
              : "warning",
      status:
        snapshot.pendingApprovalCount > 0n
          ? "Pending"
          : snapshot.finalized
            ? "Done"
            : snapshot.approverEligible
              ? "Ready"
              : "Blocked",
      text:
        snapshot.pendingApprovalCount > 0n
          ? `${snapshot.pendingApprovalCount.toString()} approval callback(s) are still pending.`
          : snapshot.finalized
            ? "Voting is closed and tallies are already fixed."
            : snapshot.approverEligible
              ? "The configured approver can submit an encrypted yes/no vote from the Approver panel."
              : "The configured approver wallet is not eligible for this proposal.",
    },
    {
      title: snapshot.finalized ? "Proposal finalized" : "Finalization",
      tone: snapshot.finalized ? (snapshot.approved ? "success" : "error") : voteWindowClosed ? "warning" : "info",
      status: snapshot.finalized ? (snapshot.approved ? "Approved" : "Rejected") : voteWindowClosed ? "Ready" : "Waiting",
      text: snapshot.finalized
        ? snapshot.approved
          ? "Finalization succeeded and the proposal met its threshold."
          : "Finalization succeeded but the proposal did not meet its threshold."
        : voteWindowClosed
          ? "Voting deadline passed. If no approval callbacks are pending, the owner can finalize now."
          : `Voting is still open until ${formatTimestamp(snapshot.deadline)}.`,
    },
    {
      title: snapshot.executed ? "Treasury payout executed" : "Treasury execution",
      tone: snapshot.executed ? "success" : snapshot.finalized && snapshot.approved ? "warning" : "info",
      status: snapshot.executed ? "Done" : snapshot.finalized && snapshot.approved ? "Ready" : "Waiting",
      text: snapshot.executed
        ? "The treasury payout was executed on the source chain."
        : snapshot.finalized && snapshot.approved
          ? "The proposal is approved and ready for `executeProposal`."
          : "Execution is blocked until finalization marks the proposal as approved.",
    },
  ];
};

function ActionNotice({ notice, getExplorerLink }) {
  if (!notice.message) return null;

  return (
    <Notice $variant={notice.variant}>
      <div>{notice.message}</div>
      {notice.txHash ? (
        <div style={{ marginTop: "8px" }}>
          <Link href={getExplorerLink(notice.txHash)} target="_blank" rel="noreferrer">
            {notice.txHash}
          </Link>
        </div>
      ) : null}
    </Notice>
  );
}

function HomePage() {
  const {
    config,
    defaults,
    getAddresses,
    getAddressLink,
    getExplorerLink,
    getProposalSnapshot,
    getTreasuryBalance,
    fundTreasury,
    createProposal,
    registerProposalRemote,
    castApproval,
    finalizeProposal,
    executeProposal,
    decryptApproverReceipt,
    decryptTallies,
  } = usePrivateTreasuryApproval();

  const addresses = getAddresses();
  const [proposalForm, setProposalForm] = useState({
    recipient: defaults.recipient,
    amountEth: "0.2",
    minutesUntilDeadline: "10",
    threshold: "1",
    approvers: defaults.approvers,
    descriptionText: "Treasury payout proposal",
  });
  const [fundAmount, setFundAmount] = useState("0.5");
  const [proposalIdInput, setProposalIdInput] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [treasuryBalance, setTreasuryBalance] = useState(0n);
  const [tallies, setTallies] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [ownerNotice, setOwnerNotice] = useState(emptyNotice);
  const [approverNotice, setApproverNotice] = useState(emptyNotice);
  const [globalNotice, setGlobalNotice] = useState(emptyNotice);
  const [loading, setLoading] = useState({
    refresh: false,
    fund: false,
    create: false,
    register: false,
    vote: false,
    finalize: false,
    execute: false,
    decrypt: false,
  });

  useEffect(() => {
    if (!proposalForm.approvers || proposalForm.approvers === defaults.approvers) {
      if (addresses.approver) {
        setProposalForm((current) => ({
          ...current,
          approvers: addresses.approver,
        }));
      }
    }
  }, [addresses.approver, defaults.approvers, proposalForm.approvers]);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      try {
        const balance = await getTreasuryBalance();
        if (!cancelled) setTreasuryBalance(balance);
      } catch {
        if (!cancelled) setTreasuryBalance(0n);
      }
    }

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [config.sourceContractAddress]);

  useEffect(() => {
    if (!proposalIdInput) return undefined;
    if (!hasPendingActivity(snapshot, defaults.zeroRequestId)) return undefined;

    const timer = window.setInterval(() => {
      refreshProposal(proposalIdInput, { silent: true }).catch(() => {});
    }, 7000);

    return () => window.clearInterval(timer);
  }, [defaults.zeroRequestId, proposalIdInput, snapshot]);

  const timeline = useMemo(
    () => buildTimeline(snapshot, defaults.zeroRequestId),
    [defaults.zeroRequestId, snapshot]
  );

  const generatedDescriptionHash = useMemo(() => {
    const text = proposalForm.descriptionText.trim();
    if (!text) {
      return defaults.descriptionHash;
    }
    return ethers.keccak256(ethers.toUtf8Bytes(text));
  }, [defaults.descriptionHash, proposalForm.descriptionText]);

  const stageTone = getStageTone(snapshot, defaults.zeroRequestId);
  const proposalExpired = isProposalExpired(snapshot);
  const deadUnregisteredProposal = isDeadUnregisteredProposal(snapshot);
  const registrationPending = Boolean(
    snapshot && !isZeroRequestId(snapshot.pendingRegister, defaults.zeroRequestId)
  );
  const finalizePending = Boolean(
    snapshot && !isZeroRequestId(snapshot.pendingFinalize, defaults.zeroRequestId)
  );
  const approvalPendingForApprover = Boolean(
    snapshot && !isZeroRequestId(snapshot.approverPendingApproval, defaults.zeroRequestId)
  );
  const canRetryRegister = Boolean(
    snapshot && !snapshot.registered && !registrationPending && !snapshot.finalized && !deadUnregisteredProposal
  );
  const canVote = Boolean(
    snapshot &&
      snapshot.registered &&
      !snapshot.finalized &&
      !proposalExpired &&
      snapshot.approverEligible &&
      !approvalPendingForApprover
  );
  const canFinalize = Boolean(
    snapshot &&
      snapshot.registered &&
      !snapshot.finalized &&
      proposalExpired &&
      snapshot.pendingApprovalCount === 0n &&
      !finalizePending
  );
  const canExecute = Boolean(snapshot && snapshot.finalized && snapshot.approved && !snapshot.executed);

  const updateLoading = (key, value) =>
    setLoading((current) => ({
      ...current,
      [key]: value,
    }));

  const refreshProposal = async (targetProposalId = proposalIdInput, options = {}) => {
    if (!targetProposalId) {
      throw new Error("Enter a proposal id first");
    }

    const silent = options.silent === true;
    updateLoading("refresh", true);
    try {
      const nextSnapshot = await getProposalSnapshot(targetProposalId);
      if (!nextSnapshot) {
        setSnapshot(null);
        setTallies(null);
        setReceipt(null);
        if (!silent) {
          setGlobalNotice({
            variant: "error",
            message: `Proposal #${targetProposalId} does not exist on the source contract.`,
            txHash: "",
          });
        }
        return;
      }

      setSnapshot(nextSnapshot);
      setProposalIdInput(nextSnapshot.proposalId.toString());
      if (!silent) {
        setGlobalNotice({
          variant: "success",
          message: "Proposal state refreshed from the source contract.",
          txHash: "",
        });
      }
    } finally {
      updateLoading("refresh", false);
    }
  };

  const handleOwnerAction = async (key, action, successMessage) => {
    updateLoading(key, true);
    try {
      const result = await action();
      setOwnerNotice({
        variant: "success",
        message: successMessage,
        txHash: result?.hash || "",
      });
      setGlobalNotice(emptyNotice);
      const balance = await getTreasuryBalance();
      setTreasuryBalance(balance);
      if (proposalIdInput) {
        await refreshProposal(proposalIdInput);
      }
    } catch (error) {
      setOwnerNotice({
        variant: "error",
        message: error.message || String(error),
        txHash: "",
      });
    } finally {
      updateLoading(key, false);
    }
  };

  const handleApproverAction = async (key, action, successMessage) => {
    updateLoading(key, true);
    try {
      const result = await action();
      setApproverNotice({
        variant: "success",
        message: successMessage,
        txHash: result?.hash || "",
      });
      setGlobalNotice(emptyNotice);
      if (proposalIdInput) {
        await refreshProposal(proposalIdInput);
      }
    } catch (error) {
      setApproverNotice({
        variant: "error",
        message: error.message || String(error),
        txHash: "",
      });
    } finally {
      updateLoading(key, false);
    }
  };

  const onFundTreasury = async () => {
    await handleOwnerAction("fund", () => fundTreasury(fundAmount), "Treasury funding transaction sent.");
  };

  const onCreateProposal = async () => {
    const approverList = proposalForm.approvers
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!/^0x[a-fA-F0-9]{40}$/.test(proposalForm.recipient)) {
      setOwnerNotice({
        variant: "error",
        message: "Recipient must be a valid address.",
        txHash: "",
      });
      return;
    }
    if (Number(proposalForm.threshold) <= 0 || Number(proposalForm.threshold) > approverList.length) {
      setOwnerNotice({
        variant: "error",
        message: "Threshold must be between 1 and the number of approvers.",
        txHash: "",
      });
      return;
    }

    updateLoading("create", true);
    try {
      const result = await createProposal({
        ...proposalForm,
        descriptionHash: generatedDescriptionHash,
      });
      setProposalIdInput(result.proposalId);
      setTallies(null);
      setReceipt(null);
      setOwnerNotice({
        variant: "success",
        message: `Created proposal #${result.proposalId}. Registration is asynchronous, so refresh after the callback lands.`,
        txHash: result.hash,
      });
      const balance = await getTreasuryBalance();
      setTreasuryBalance(balance);
      await refreshProposal(result.proposalId);
    } catch (error) {
      setOwnerNotice({
        variant: "error",
        message: error.message || String(error),
        txHash: "",
      });
    } finally {
      updateLoading("create", false);
    }
  };

  const onRetryRegister = async () => {
    if (!canRetryRegister) {
      setOwnerNotice({
        variant: "warning",
        message: deadUnregisteredProposal
          ? "This proposal expired before remote registration completed. Create a new proposal instead of retrying this one."
          : "Registration cannot be retried in the current state.",
        txHash: "",
      });
      return;
    }
    await handleOwnerAction(
      "register",
      () => registerProposalRemote(proposalIdInput),
      "Retry registration transaction sent. Refresh after the callback lands."
    );
  };

  const onVote = async (support) => {
    if (!canVote) {
      setApproverNotice({
        variant: "warning",
        message: proposalExpired
          ? "Voting is closed for this proposal."
          : "This proposal is not ready for approval yet.",
        txHash: "",
      });
      return;
    }
    await handleApproverAction(
      "vote",
      () => castApproval(proposalIdInput, support),
      `Encrypted ${support ? "YES" : "NO"} vote submitted. Refresh after the callback lands.`
    );
  };

  const onFinalize = async () => {
    if (!canFinalize) {
      setOwnerNotice({
        variant: "warning",
        message: deadUnregisteredProposal
          ? "This proposal expired before remote registration completed, so finalization is not available. Create a new proposal after the miner/relay path is working."
          : proposalExpired
            ? "Finalization is only available after registration completes and all approval callbacks are finished."
            : "This proposal is still in its voting window.",
        txHash: "",
      });
      return;
    }
    await handleOwnerAction(
      "finalize",
      () => finalizeProposal(proposalIdInput),
      "Finalize transaction sent. Refresh after the callback lands."
    );
  };

  const onExecute = async () => {
    if (!canExecute) {
      setOwnerNotice({
        variant: "warning",
        message: "Execution is only available for approved proposals that have already been finalized.",
        txHash: "",
      });
      return;
    }
    await handleOwnerAction(
      "execute",
      () => executeProposal(proposalIdInput),
      "Execution transaction sent."
    );
  };

  const onDecryptTallies = async () => {
    updateLoading("decrypt", true);
    try {
      const result = await decryptTallies(proposalIdInput);
      setTallies(result);
      setOwnerNotice({
        variant: "success",
        message: result
          ? `Tallies decrypted successfully. Yes=${result.yesVotes.toString()} No=${result.noVotes.toString()}`
          : "No encrypted tallies are available yet.",
        txHash: "",
      });
    } catch (error) {
      setOwnerNotice({
        variant: "error",
        message: error.message || String(error),
        txHash: "",
      });
    } finally {
      updateLoading("decrypt", false);
    }
  };

  const onDecryptReceipt = async () => {
    updateLoading("decrypt", true);
    try {
      const result = await decryptApproverReceipt(proposalIdInput);
      setReceipt(result);
      setApproverNotice({
        variant: "success",
        message: result
          ? `Vote receipt decrypted. The recorded vote was ${result.support ? "YES" : "NO"}.`
          : "No encrypted vote receipt is available yet.",
        txHash: "",
      });
    } catch (error) {
      setApproverNotice({
        variant: "error",
        message: error.message || String(error),
        txHash: "",
      });
    } finally {
      updateLoading("decrypt", false);
    }
  };

  return (
    <AppContainer>
      <Section>
        <CardGrid>
          <Card $span={12}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ maxWidth: "760px" }}>
                <Title>Private Treasury Approval</Title>
                <Subtitle style={{ marginTop: "12px" }}>
                  A stage-based demo shell for the `PrivateTreasuryApproval` flow. The owner proposes a payout on the
                  source chain, COTI privately tallies encrypted approvals, then the owner finalizes and executes if the
                  threshold is met.
                </Subtitle>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <Badge $tone={config.missingConfig.length ? "error" : stageTone}>
                  {config.missingConfig.length ? "Config incomplete" : snapshot ? "Proposal loaded" : "Ready"}
                </Badge>
                {proposalExpired ? <Badge $tone="warning">Voting period ended</Badge> : null}
                {deadUnregisteredProposal ? <Badge $tone="error">Registration missed deadline</Badge> : null}
              </div>
            </div>

            <MetricList style={{ marginTop: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Metric>
                <MetricLabel>Source Treasury Contract</MetricLabel>
                <MetricValue>
                  {config.sourceContractAddress ? (
                    <Link href={getAddressLink(config.sourceContractAddress)} target="_blank" rel="noreferrer">
                      {shorten(config.sourceContractAddress)}
                    </Link>
                  ) : (
                    "Not configured"
                  )}
                </MetricValue>
              </Metric>
              <Metric>
                <MetricLabel>COTI Treasury Contract</MetricLabel>
                <MetricValue>
                  {config.cotiContractAddress ? (
                    <Link href={getAddressLink(config.cotiContractAddress, "coti")} target="_blank" rel="noreferrer">
                      {shorten(config.cotiContractAddress)}
                    </Link>
                  ) : (
                    "Not configured"
                  )}
                </MetricValue>
              </Metric>
              <Metric>
                <MetricLabel>Treasury Balance</MetricLabel>
                <MetricValue>{formatEth(treasuryBalance)}</MetricValue>
              </Metric>
              <Metric>
                <MetricLabel>Configured Fees</MetricLabel>
                <MetricValue>
                  callback <Mono>{config.callbackFeeWei.toString()}</Mono>
                  <br />
                  create <Mono>{config.createTotalFeeWei.toString()}</Mono>
                  <br />
                  vote <Mono>{config.approvalTotalFeeWei.toString()}</Mono>
                  <br />
                  finalize <Mono>{config.finalizeTotalFeeWei.toString()}</Mono>
                </MetricValue>
              </Metric>
            </MetricList>

            {config.missingConfig.length ? (
              <Notice $variant="error" style={{ marginTop: "18px" }}>
                Missing env vars: <Mono>{config.missingConfig.join(", ")}</Mono>
              </Notice>
            ) : null}

            <ActionNotice notice={globalNotice} getExplorerLink={getExplorerLink} />
          </Card>

          <Card $span={5}>
            <CardTitle>Owner Flow</CardTitle>
            <Subtitle>
              The owner funds the treasury, creates the proposal, retries registration if needed, finalizes after the
              deadline, and executes approved payouts.
            </Subtitle>

            <MetricList style={{ marginTop: "16px" }}>
              <Metric>
                <MetricLabel>Owner Wallet</MetricLabel>
                <MetricValue>
                  {addresses.owner ? (
                    <Link href={getAddressLink(addresses.owner)} target="_blank" rel="noreferrer">
                      {addresses.owner}
                    </Link>
                  ) : (
                    "Not configured"
                  )}
                </MetricValue>
              </Metric>
            </MetricList>

            <Divider />

            <Field>
              <Label htmlFor="fund-amount">Treasury funding amount (ETH)</Label>
              <Input id="fund-amount" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} />
            </Field>

            <ButtonRow>
              <Button onClick={onFundTreasury} disabled={loading.fund}>
                {loading.fund ? "Funding..." : "Fund Treasury"}
              </Button>
            </ButtonRow>

            <Divider />

            <Field>
              <Label htmlFor="recipient">Recipient</Label>
              <Input
                id="recipient"
                value={proposalForm.recipient}
                onChange={(event) => setProposalForm((current) => ({ ...current, recipient: event.target.value }))}
              />
            </Field>

            <FieldRow>
              <Field>
                <Label htmlFor="amount">Payout amount (ETH)</Label>
                <Input
                  id="amount"
                  value={proposalForm.amountEth}
                  onChange={(event) => setProposalForm((current) => ({ ...current, amountEth: event.target.value }))}
                />
              </Field>
              <Field>
                <Label htmlFor="threshold">Threshold</Label>
                <Input
                  id="threshold"
                  value={proposalForm.threshold}
                  onChange={(event) => setProposalForm((current) => ({ ...current, threshold: event.target.value }))}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field>
                <Label htmlFor="deadline-minutes">Minutes until deadline</Label>
                <Input
                  id="deadline-minutes"
                  value={proposalForm.minutesUntilDeadline}
                  onChange={(event) =>
                    setProposalForm((current) => ({ ...current, minutesUntilDeadline: event.target.value }))
                  }
                />
              </Field>
            </FieldRow>

            <Field>
              <Label htmlFor="description-text">Proposal summary</Label>
              <TextArea
                id="description-text"
                value={proposalForm.descriptionText}
                onChange={(event) =>
                  setProposalForm((current) => ({ ...current, descriptionText: event.target.value }))
                }
              />
              <HelperText>
                A readable description is hashed automatically before the proposal is submitted.
              </HelperText>
              <HelperText>
                Generated description hash: <Mono>{generatedDescriptionHash}</Mono>
              </HelperText>
            </Field>

            <Field>
              <Label htmlFor="approvers">Approvers (comma or newline separated)</Label>
              <TextArea
                id="approvers"
                value={proposalForm.approvers}
                onChange={(event) => setProposalForm((current) => ({ ...current, approvers: event.target.value }))}
              />
              <HelperText>
                Keep this list small. This shell is for a focused example, not a full committee admin console.
              </HelperText>
            </Field>

            <Field>
              <Label htmlFor="selected-proposal-id">Selected proposal id</Label>
              <Input
                id="selected-proposal-id"
                value={proposalIdInput}
                onChange={(event) => setProposalIdInput(event.target.value)}
                placeholder="Filled automatically after proposal creation"
              />
              <HelperText>
                Used for refresh, approval, finalization, execution, and decryption actions.
              </HelperText>
            </Field>

            <ButtonRow>
              <Button onClick={onCreateProposal} disabled={loading.create}>
                {loading.create ? "Creating..." : "Create Proposal"}
              </Button>
              <Button onClick={() => refreshProposal()} disabled={loading.refresh} $variant="secondary">
                {loading.refresh ? "Refreshing..." : "Refresh"}
              </Button>
            </ButtonRow>

            <ButtonRow $top="12px">
              <Button
                onClick={onRetryRegister}
                disabled={loading.register || !proposalIdInput || !canRetryRegister}
                $variant="secondary"
              >
                {loading.register ? "Retrying..." : "Retry Register"}
              </Button>
              <Button onClick={onFinalize} disabled={loading.finalize || !proposalIdInput || !canFinalize}>
                {loading.finalize ? "Finalizing..." : "Finalize"}
              </Button>
              <Button onClick={onExecute} disabled={loading.execute || !proposalIdInput || !canExecute}>
                {loading.execute ? "Executing..." : "Execute"}
              </Button>
            </ButtonRow>

            <ButtonRow $top="12px">
              <Button onClick={onDecryptTallies} disabled={loading.decrypt || !proposalIdInput} $variant="secondary">
                {loading.decrypt ? "Decrypting..." : "Decrypt Tallies"}
              </Button>
            </ButtonRow>

            <ActionNotice notice={ownerNotice} getExplorerLink={getExplorerLink} />
          </Card>

          <Card $span={3}>
            <CardTitle>Approver Flow</CardTitle>
            <Subtitle>
              The approver signs the source-chain transaction, but the vote itself is encrypted with the COTI wallet and
              only the recorded receipt can be decrypted later.
            </Subtitle>

            <MetricList style={{ marginTop: "16px" }}>
              <Metric>
                <MetricLabel>Approver Wallet</MetricLabel>
                <MetricValue>
                  {addresses.approver ? (
                    <Link href={getAddressLink(addresses.approver)} target="_blank" rel="noreferrer">
                      {addresses.approver}
                    </Link>
                  ) : (
                    "Not configured"
                  )}
                </MetricValue>
              </Metric>
            </MetricList>

            <Divider />

            <Field>
              <Label htmlFor="approver-proposal-id">Proposal id</Label>
              <Input
                id="approver-proposal-id"
                value={proposalIdInput}
                onChange={(event) => setProposalIdInput(event.target.value)}
              />
            </Field>

            <ButtonRow>
              <Button onClick={() => onVote(true)} disabled={loading.vote || !proposalIdInput || !canVote}>
                {loading.vote ? "Submitting..." : "Vote YES"}
              </Button>
              <Button
                onClick={() => onVote(false)}
                disabled={loading.vote || !proposalIdInput || !canVote}
                $variant="secondary"
              >
                {loading.vote ? "Submitting..." : "Vote NO"}
              </Button>
            </ButtonRow>

            <ButtonRow $top="12px">
              <Button onClick={onDecryptReceipt} disabled={loading.decrypt || !proposalIdInput} $variant="secondary">
                {loading.decrypt ? "Decrypting..." : "Decrypt Receipt"}
              </Button>
            </ButtonRow>

            {receipt ? (
              <Notice $variant="success">
                Recorded vote: <strong>{receipt.support ? "YES" : "NO"}</strong>
              </Notice>
            ) : null}

            <ActionNotice notice={approverNotice} getExplorerLink={getExplorerLink} />
          </Card>

          <Card $span={4}>
            <CardTitle>Proposal Snapshot</CardTitle>
            {snapshot ? (
              <>
                {proposalExpired ? (
                  <Notice $variant="warning" style={{ marginBottom: "12px" }}>
                    This proposal has reached its voting deadline. No new approvals should be submitted. If no approval
                    callbacks are still pending, the next step is finalization.
                  </Notice>
                ) : null}
                {deadUnregisteredProposal ? (
                  <Notice $variant="error" style={{ marginBottom: "12px" }}>
                    This proposal expired before remote registration completed. It is not a useful candidate for
                    approval or finalization anymore. Create a new proposal after the miner/relay path is running.
                  </Notice>
                ) : null}
                <MetricList>
                <Metric>
                  <MetricLabel>Proposal</MetricLabel>
                  <MetricValue>
                    #{snapshot.proposalId.toString()} to{" "}
                    <Link href={getAddressLink(snapshot.recipient)} target="_blank" rel="noreferrer">
                      {snapshot.recipient}
                    </Link>
                  </MetricValue>
                </Metric>
                <Metric>
                  <MetricLabel>Status</MetricLabel>
                  <MetricValue>
                    registered={String(snapshot.registered)}
                    <br />
                    finalized={String(snapshot.finalized)}
                    <br />
                    approved={String(snapshot.approved)}
                    <br />
                    executed={String(snapshot.executed)}
                  </MetricValue>
                </Metric>
                <Metric>
                  <MetricLabel>Voting Window</MetricLabel>
                  <MetricValue>
                    deadline {formatTimestamp(snapshot.deadline)}
                    <br />
                    threshold {snapshot.threshold.toString()}
                    <br />
                    pending approvals {snapshot.pendingApprovalCount.toString()}
                  </MetricValue>
                </Metric>
                <Metric>
                  <MetricLabel>Cross-chain Request Ids</MetricLabel>
                  <MetricValue>
                    register <Mono>{snapshot.pendingRegister}</Mono>
                    <br />
                    finalize <Mono>{snapshot.pendingFinalize}</Mono>
                    <br />
                    approver <Mono>{snapshot.approverPendingApproval}</Mono>
                  </MetricValue>
                </Metric>
                {tallies ? (
                  <Metric>
                    <MetricLabel>Decrypted Tallies</MetricLabel>
                    <MetricValue>
                      yes {tallies.yesVotes.toString()}
                      <br />
                      no {tallies.noVotes.toString()}
                    </MetricValue>
                  </Metric>
                ) : null}
                </MetricList>
              </>
            ) : (
              <Notice $variant="warning">
                Load a proposal id to see live source-chain state.
              </Notice>
            )}
          </Card>

          <Card $span={12}>
            <CardTitle>Lifecycle Timeline</CardTitle>
            <Subtitle>
              This workflow completes in stages. Registration, approvals, and finalization may remain pending while
              cross-chain callbacks are processed.
            </Subtitle>
            <HelperText style={{ marginTop: "8px" }}>
              {proposalIdInput && hasPendingActivity(snapshot, defaults.zeroRequestId)
                ? "State refresh is running automatically while a cross-chain step is pending."
                : "Once a proposal is selected, this view advances as each stage completes."}
            </HelperText>

            <StepFlow style={{ marginTop: "18px" }}>
              {timeline.length ? (
                timeline.map((item, index) => (
                  <React.Fragment key={item.title}>
                    <StepCard $tone={item.tone}>
                      <StepHeader>
                        <StepNumber>{index + 1}</StepNumber>
                        <Badge $tone={item.tone}>{item.status}</Badge>
                      </StepHeader>
                      <TimelineTitle>{item.title}</TimelineTitle>
                      <TimelineText>{item.text}</TimelineText>
                    </StepCard>
                    {index < timeline.length - 1 ? <StepArrow>→</StepArrow> : null}
                  </React.Fragment>
                ))
              ) : (
                <TimelineItem>
                  <TimelineDot $tone="info" />
                  <TimelineContent>
                    <TimelineTitle>Nothing loaded yet</TimelineTitle>
                    <TimelineText>
                      Create or refresh a proposal to populate the timeline. If callbacks are delayed, use the refresh
                      button instead of assuming failure.
                    </TimelineText>
                  </TimelineContent>
                </TimelineItem>
              )}
            </StepFlow>
          </Card>
        </CardGrid>
      </Section>
    </AppContainer>
  );
}

export default HomePage;
