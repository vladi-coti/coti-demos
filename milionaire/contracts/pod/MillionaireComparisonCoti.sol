// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { InboxUser } from "pod-mpc-lib/InboxUser.sol";
import { ctBool, gtBool, gtUint64, MpcCore } from "pod-mpc-lib/utils/mpc/MpcCore.sol";

/**
 * @title MillionaireComparisonCoti
 * @notice COTI-side private logic for the Millionaires' Problem PoD demo.
 */
contract MillionaireComparisonCoti is InboxUser {
    event ComparisonComputed(address indexed alice, address indexed bob);

    constructor(address inbox_) {
        setInbox(inbox_);
    }

    function compareWealth(gtUint64 aliceWealth, gtUint64 bobWealth, address alice, address bob) external onlyInbox {
        gtBool aliceIsRicher = MpcCore.gt(aliceWealth, bobWealth);
        ctBool aliceResult = MpcCore.offBoardToUser(aliceIsRicher, alice);
        ctBool bobResult = MpcCore.offBoardToUser(aliceIsRicher, bob);

        emit ComparisonComputed(alice, bob);
        inbox.respond(abi.encode(aliceResult, bobResult));
    }
}
