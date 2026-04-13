// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "./IInbox.sol";

abstract contract InboxUser {
    IInbox public inbox;

    error OnlyInbox(address caller);

    modifier onlyInbox() {
        if (msg.sender != address(inbox)) {
            revert OnlyInbox(msg.sender);
        }
        _;
    }

    function setInbox(address _inbox) internal {
        inbox = IInbox(_inbox);
    }
}
