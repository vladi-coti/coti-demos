// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../IInbox.sol";
import "./PodUser.sol";

abstract contract PodLibBase is PodUser {
    constructor(address initialOwner) PodUser(initialOwner) {}

    uint256 internal constant MIN_CALLBACK_FEE_WEI = 1;

    receive() external payable {}

    function _sendTwoWayWithFee(
        uint256 totalValueWei,
        uint256 callbackFeeLocalWei,
        uint256 targetChainId_,
        address targetContract_,
        IInbox.MpcMethodCall memory mpcMethodCall,
        bytes4 callbackSelector_,
        bytes4 errorSelector_
    ) internal returns (bytes32) {
        require(callbackFeeLocalWei >= MIN_CALLBACK_FEE_WEI, "PodLib: callback fee min");
        require(callbackFeeLocalWei <= totalValueWei, "PodLib: callback exceeds total");
        require(address(this).balance >= totalValueWei, "PodLib: inbox fee");

        return IInbox(inbox).sendTwoWayMessage{value: totalValueWei}(
            targetChainId_,
            targetContract_,
            mpcMethodCall,
            callbackSelector_,
            errorSelector_,
            callbackFeeLocalWei
        );
    }

    function onDefaultMpcError(bytes32 requestId) external onlyInbox {
        (uint256 code, string memory message) = inbox.getOutboxError(requestId);
        emit ErrorRemoteCall(requestId, code, message);
    }
}
