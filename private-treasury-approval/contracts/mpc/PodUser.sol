// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../InboxUser.sol";

abstract contract PodUser is InboxUser, Ownable {
    event ErrorRemoteCall(bytes32 requestId, uint256 code, string message);

    address internal mpcExecutorAddress = address(0);
    uint256 internal cotiChainId = 2632500;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function configureCoti(address _mpcExecutorAddress, uint256 _cotiChainId) internal virtual {
        mpcExecutorAddress = _mpcExecutorAddress;
        cotiChainId = _cotiChainId;
    }

    function configure(address inbox_, address mpcExecutor_, uint256 cotiChainId_) external onlyOwner {
        if (inbox_ != address(0)) {
            setInbox(inbox_);
        }
        configureCoti(mpcExecutor_, cotiChainId_);
    }
}
