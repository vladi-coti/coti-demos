// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@coti-io/coti-contracts/contracts/utils/mpc/MpcCore.sol";

interface IPrivateTreasuryApprovalCoti {
    function registerProposal(uint256 proposalId, uint256 threshold, uint256 deadline) external;

    function castApproval(uint256 proposalId, address voter, gtBool support) external;

    function finalizeProposal(uint256 proposalId, address resultOwner) external;
}
