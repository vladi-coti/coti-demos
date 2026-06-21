// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import { PodLibBase } from "pod-mpc-lib/mpc/PodLibBase.sol";
import { IInbox } from "pod-mpc-lib/IInbox.sol";
import { MpcAbiCodec } from "pod-mpc-lib/mpccodec/MpcAbiCodec.sol";
import { ctBool, ctUint64, gtUint64, itUint64 } from "pod-mpc-lib/utils/mpc/MpcCore.sol";

interface IMillionaireComparisonCoti {
    function compareWealth(gtUint64 aliceWealth, gtUint64 bobWealth, address alice, address bob) external;
}

/**
 * @title MillionaireComparisonPod
 * @notice Yao's Millionaires' Problem using COTI PoD MPC — **64-bit** encrypted wealth.
 * @dev Network-agnostic: the owner sets the inbox and COTI routing post-deploy via {PodUser-configure}.
 */
contract MillionaireComparisonPod is PodLibBase {
    using MpcAbiCodec for MpcAbiCodec.MpcMethodCallContext;

    bytes32 public compareRequestIdAlice;
    bytes32 public compareRequestIdBob;

    itUint64 private _aliceWealth;
    itUint64 private _bobWealth;

    bool private _aliceSet;
    bool private _bobSet;

    ctBool private _aliceResult;
    ctBool private _bobResult;
    bool public aliceResultReady;
    bool public bobResultReady;

    address private _alice;
    address private _bob;

    event WealthSubmitted(address indexed user, bool isAlice);

    event ComparisonRequested(
        address indexed requester,
        bytes32 requestIdAlice,
        bytes32 requestIdBob
    );

    event ResultReady(address indexed user, bytes32 requestId);

    event ComparisonReset();

    event PlayersConfigured(address indexed alice, address indexed bob);

    constructor() PodLibBase(msg.sender) {
    }

    function configurePlayers(address alice, address bob) external onlyOwner {
        require(_alice == address(0) && _bob == address(0), "Players already configured");
        require(alice != address(0) && bob != address(0), "Invalid addresses");
        require(alice != bob, "Alice and Bob must be different");

        _alice = alice;
        _bob = bob;

        emit PlayersConfigured(alice, bob);
    }

    function isAliceWealthSet() external view returns (bool) {
        return _aliceSet;
    }

    function isBobWealthSet() external view returns (bool) {
        return _bobSet;
    }

    function areBothWealthsSet() external view returns (bool) {
        return _aliceSet && _bobSet;
    }

    function setAliceWealth(itUint64 calldata wealth) external {
        require(_alice != address(0), "Players not configured");
        require(msg.sender == _alice, "Only Alice can set her wealth");
        require(!_aliceSet, "Alice's wealth already set");

        _aliceWealth = wealth;
        _aliceSet = true;

        emit WealthSubmitted(msg.sender, true);
    }

    function setBobWealth(itUint64 calldata wealth) external {
        require(_bob != address(0), "Players not configured");
        require(msg.sender == _bob, "Only Bob can set his wealth");
        require(!_bobSet, "Bob's wealth already set");

        _bobWealth = wealth;
        _bobSet = true;

        emit WealthSubmitted(msg.sender, false);
    }

    /// @param callbackFeeWei Native wei forwarded to the inbox for the callback that carries both user results.
    function compareWealth(uint256 callbackFeeWei) external payable {
        require(_alice != address(0) && _bob != address(0), "Players not configured");
        require(_aliceSet && _bobSet, "Both parties must submit their wealth first");
        require(msg.value >= 200 gwei, "need 200 gwei fee for MPC callback");
        require(callbackFeeWei >= MIN_CALLBACK_FEE_WEI, "callback fee too low");
        require(callbackFeeWei < msg.value, "callback fee exceeds budget");

        itUint64 memory aliceWealth = _aliceWealth;
        itUint64 memory bobWealth = _bobWealth;

        IInbox.MpcMethodCall memory methodCall = MpcAbiCodec
            .create(IMillionaireComparisonCoti.compareWealth.selector, 4)
            .addArgument(aliceWealth)
            .addArgument(bobWealth)
            .addArgument(_alice)
            .addArgument(_bob)
            .build();

        bytes32 requestId = _forwardTwoWay(
            methodCall,
            this.revealCallback.selector,
            this.onDefaultMpcError.selector,
            msg.value,
            callbackFeeWei);
        compareRequestIdAlice = requestId;
        compareRequestIdBob = requestId;

        emit ComparisonRequested(msg.sender, compareRequestIdAlice, compareRequestIdBob);
    }

    function revealCallback(bytes memory data) external onlyInbox {
        bytes32 requestId = inbox.inboxSourceRequestId();
        if (requestId == compareRequestIdAlice) {
            (ctBool aliceResult, ctBool bobResult) = abi.decode(data, (ctBool, ctBool));
            _aliceResult = aliceResult;
            _bobResult = bobResult;
            aliceResultReady = true;
            bobResultReady = true;
            emit ResultReady(_alice, requestId);
            emit ResultReady(_bob, requestId);
        }
    }

    function getAliceResult() public view returns (ctBool) {
        require(msg.sender == _alice, "Only Alice can view her result");
        return _aliceResult;
    }

    function getBobResult() public view returns (ctBool) {
        require(msg.sender == _bob, "Only Bob can view his result");
        return _bobResult;
    }

    function getAliceAddress() external view returns (address) {
        return _alice;
    }

    function getBobAddress() external view returns (address) {
        return _bob;
    }

    function getAliceWealth() public view returns (ctUint64) {
        require(_aliceSet, "Alice's wealth not set yet");
        return _aliceWealth.ciphertext;
    }

    function getBobWealth() public view returns (ctUint64) {
        require(_bobSet, "Bob's wealth not set yet");
        return _bobWealth.ciphertext;
    }

    function reset() external {
        require(_alice != address(0), "Players not configured");
        require(msg.sender == _alice, "Only Alice can reset the contract");
        _aliceSet = false;
        _bobSet = false;
        aliceResultReady = false;
        bobResultReady = false;
        emit ComparisonReset();
    }
}
