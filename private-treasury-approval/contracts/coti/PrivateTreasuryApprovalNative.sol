// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@coti-io/coti-contracts/contracts/utils/mpc/MpcCore.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PrivateTreasuryApprovalNative is Ownable, ReentrancyGuard {
    struct PayoutProposal {
        address recipient;
        address asset;
        uint256 amount;
        bytes32 descriptionHash;
        uint64 deadline;
        uint64 threshold;
        bool exists;
        bool registered;
        bool finalized;
        bool approved;
        bool executed;
    }

    error UnsupportedAsset(address asset);
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidDeadline(uint64 deadline);
    error InvalidThreshold(uint64 threshold, uint256 approverCount);
    error DuplicateApprover(address approver);
    error ProposalUnknown(uint256 proposalId);
    error ProposalAlreadyRegistered(uint256 proposalId);
    error ProposalNotRegistered(uint256 proposalId);
    error ProposalAlreadyFinalized(uint256 proposalId);
    error VotingClosed(uint256 proposalId);
    error VotingStillOpen(uint256 proposalId, uint64 deadline);
    error NotEligibleApprover(uint256 proposalId, address voter);
    error ProposalNotApproved(uint256 proposalId);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error AlreadyVoted(uint256 proposalId, address voter);
    error EthTransferFailed(address recipient, uint256 amount);

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed recipient,
        uint256 amount,
        uint64 deadline,
        uint64 threshold
    );
    event ApprovalRecorded(uint256 indexed proposalId, address indexed voter, ctBool recordedVote);
    event ProposalFinalized(uint256 indexed proposalId, bool approved, ctUint64 yesVotes, ctUint64 noVotes);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount);

    uint256 public nextProposalId = 1;

    mapping(uint256 => PayoutProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public isEligibleApprover;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bytes32)) public pendingApprovalRequestIdOf;
    mapping(uint256 => bytes32) public pendingRegisterRequestIdOf;
    mapping(uint256 => bytes32) public pendingFinalizeRequestIdOf;
    mapping(uint256 => uint256) public pendingApprovalCountOf;
    mapping(uint256 => mapping(address => ctBool)) public recordedVoteReceiptOf;
    mapping(uint256 => ctUint64) public encryptedYesVotesOf;
    mapping(uint256 => ctUint64) public encryptedNoVotesOf;
    mapping(uint256 => gtUint64) private _yesVotesGtOf;
    mapping(uint256 => gtUint64) private _noVotesGtOf;

    constructor() Ownable(msg.sender) {}

    receive() external payable {}

    function createProposal(
        address recipient,
        address asset,
        uint256 amount,
        bytes32 descriptionHash,
        uint64 deadline,
        uint64 threshold,
        address[] calldata approvers,
        uint256
    ) external payable onlyOwner nonReentrant returns (uint256 proposalId, bytes32 requestId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (asset != address(0)) revert UnsupportedAsset(asset);
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline(deadline);
        if (threshold == 0 || threshold > approvers.length) revert InvalidThreshold(threshold, approvers.length);

        proposalId = nextProposalId++;
        PayoutProposal storage proposal = proposals[proposalId];
        proposal.recipient = recipient;
        proposal.asset = asset;
        proposal.amount = amount;
        proposal.descriptionHash = descriptionHash;
        proposal.deadline = deadline;
        proposal.threshold = threshold;
        proposal.exists = true;
        proposal.registered = true;

        uint256 approverCount = approvers.length;
        for (uint256 i = 0; i < approverCount; ++i) {
            address approver = approvers[i];
            if (approver == address(0)) revert InvalidRecipient();
            for (uint256 j = 0; j < i; ++j) {
                if (approvers[j] == approver) revert DuplicateApprover(approver);
            }
            isEligibleApprover[proposalId][approver] = true;
        }

        gtUint64 zero = MpcCore.setPublic64(0);
        _yesVotesGtOf[proposalId] = zero;
        _noVotesGtOf[proposalId] = zero;

        emit ProposalCreated(proposalId, recipient, amount, deadline, threshold);
        return (proposalId, bytes32(0));
    }

    function registerProposalRemote(uint256 proposalId, uint256)
        external
        payable
        onlyOwner
        returns (bytes32)
    {
        _requireExistingProposal(proposalId);
        revert ProposalAlreadyRegistered(proposalId);
    }

    function castApproval(uint256 proposalId, itBool calldata support, uint256)
        external
        payable
        nonReentrant
        returns (bytes32 requestId)
    {
        PayoutProposal storage proposal = _requireActiveProposal(proposalId);
        if (!isEligibleApprover[proposalId][msg.sender]) {
            revert NotEligibleApprover(proposalId, msg.sender);
        }
        if (hasVoted[proposalId][msg.sender]) {
            revert AlreadyVoted(proposalId, msg.sender);
        }
        if (block.timestamp >= proposal.deadline) {
            revert VotingClosed(proposalId);
        }

        gtBool validatedSupport = MpcCore.validateCiphertext(support);
        gtUint64 zero = MpcCore.setPublic64(0);
        gtUint64 one = MpcCore.setPublic64(1);
        gtUint64 yesIncrement = MpcCore.mux(validatedSupport, zero, one);
        gtUint64 noIncrement = MpcCore.mux(validatedSupport, one, zero);

        _yesVotesGtOf[proposalId] = MpcCore.checkedAdd(_yesVotesGtOf[proposalId], yesIncrement);
        _noVotesGtOf[proposalId] = MpcCore.checkedAdd(_noVotesGtOf[proposalId], noIncrement);
        hasVoted[proposalId][msg.sender] = true;

        ctBool recordedVote = MpcCore.offBoardToUser(validatedSupport, msg.sender);
        recordedVoteReceiptOf[proposalId][msg.sender] = recordedVote;

        emit ApprovalRecorded(proposalId, msg.sender, recordedVote);
        return bytes32(0);
    }

    function finalizeProposal(uint256 proposalId, uint256)
        external
        payable
        nonReentrant
        returns (bytes32 requestId)
    {
        PayoutProposal storage proposal = _requireExistingProposal(proposalId);
        if (!proposal.registered) revert ProposalNotRegistered(proposalId);
        if (proposal.finalized) revert ProposalAlreadyFinalized(proposalId);
        if (block.timestamp < proposal.deadline) revert VotingStillOpen(proposalId, proposal.deadline);

        gtUint64 yesVotes = _yesVotesGtOf[proposalId];
        gtUint64 noVotes = _noVotesGtOf[proposalId];
        gtBool approvedGt = MpcCore.ge(yesVotes, MpcCore.setPublic64(proposal.threshold));
        bool approved = MpcCore.decrypt(approvedGt);

        proposal.finalized = true;
        proposal.approved = approved;
        encryptedYesVotesOf[proposalId] = MpcCore.offBoardToUser(yesVotes, owner());
        encryptedNoVotesOf[proposalId] = MpcCore.offBoardToUser(noVotes, owner());

        emit ProposalFinalized(proposalId, approved, encryptedYesVotesOf[proposalId], encryptedNoVotesOf[proposalId]);
        return bytes32(0);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        PayoutProposal storage proposal = _requireExistingProposal(proposalId);
        if (!proposal.finalized || !proposal.approved) revert ProposalNotApproved(proposalId);
        if (proposal.executed) revert ProposalAlreadyExecuted(proposalId);
        if (proposal.asset != address(0)) revert UnsupportedAsset(proposal.asset);

        proposal.executed = true;
        (bool ok,) = proposal.recipient.call{value: proposal.amount}("");
        if (!ok) revert EthTransferFailed(proposal.recipient, proposal.amount);

        emit ProposalExecuted(proposalId, proposal.recipient, proposal.amount);
    }

    function _requireExistingProposal(uint256 proposalId) internal view returns (PayoutProposal storage proposal) {
        proposal = proposals[proposalId];
        if (!proposal.exists) revert ProposalUnknown(proposalId);
    }

    function _requireActiveProposal(uint256 proposalId) internal view returns (PayoutProposal storage proposal) {
        proposal = _requireExistingProposal(proposalId);
        if (!proposal.registered) revert ProposalNotRegistered(proposalId);
        if (proposal.finalized) revert ProposalAlreadyFinalized(proposalId);
    }
}
