// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IInbox {
    struct MpcMethodCall {
        bytes4 selector;
        bytes data;
        bytes8[] datatypes;
        bytes32[] datalens;
    }

    function sendTwoWayMessage(
        uint256 targetChainId,
        address targetContract,
        MpcMethodCall calldata methodCall,
        bytes4 callbackSelector,
        bytes4 errorSelector,
        uint256 callbackFeeLocalWei
    ) external payable returns (bytes32);

    function respond(bytes memory data) external;

    function raise(bytes memory data) external;

    function getOutboxError(bytes32 requestId) external view returns (uint256 code, string memory message);

    function inboxRequestId() external view returns (bytes32);

    function inboxSourceRequestId() external view returns (bytes32);
}
