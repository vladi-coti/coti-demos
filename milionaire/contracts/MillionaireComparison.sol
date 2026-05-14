// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@coti-io/coti-contracts/contracts/utils/mpc/MpcCore.sol";

/**
 * @title MillionaireComparison
 * @notice Implements Yao's Millionaires' Problem using COTI's MPC (Multi-Party Computation)
 * @dev Two parties (Alice and Bob) can compare their wealth without revealing the actual amounts
 */
contract MillionaireComparison {
    // Store encrypted wealth values
    utUint64 private _aliceWealth;
    utUint64 private _bobWealth;
    
    // Track who has submitted their wealth
    bool private _aliceSet;
    bool private _bobSet;
    
    // Store comparison results for each party (true = you're richer)
    utBool private _aliceResult;  // Result encrypted for Alice
    utBool private _bobResult;    // Result encrypted for Bob
    
    // Store addresses for consistent encryption
    address private _alice;
    address private _bob;
    
    // Events for tracking operations
    event WealthSubmitted(address indexed user, string role);
    event ComparisonCompleted(address indexed requester);
    
    /**
     * @notice Initialize the contract with Alice and Bob addresses
     * @param alice Address of the first party (Alice)
     * @param bob Address of the second party (Bob)
     */
    constructor(address alice, address bob) {
        require(alice != address(0) && bob != address(0), "Invalid addresses");
        require(alice != bob, "Alice and Bob must be different");
        
        _alice = alice;
        _bob = bob;
        _aliceSet = false;
        _bobSet = false;
    }

    /**
     * @notice Check if Alice has submitted her wealth
     */
    function isAliceWealthSet() external view returns (bool) {
        return _aliceSet;
    }

    /**
     * @notice Check if Bob has submitted his wealth
     */
    function isBobWealthSet() external view returns (bool) {
        return _bobSet;
    }

    /**
     * @notice Check if both parties have submitted their wealth
     */
    function areBothWealthsSet() external view returns (bool) {
        return _aliceSet && _bobSet;
    }

    /**
     * @notice Alice submits her encrypted wealth
     * @param wealth Encrypted input (itUint64) representing Alice's wealth
     */
    function setAliceWealth(itUint64 calldata wealth) external {
        require(msg.sender == _alice, "Only Alice can set her wealth");
        require(!_aliceSet, "Alice's wealth already set");
        
        gtUint64 gtWealth = MpcCore.validateCiphertext(wealth);
        _aliceWealth = MpcCore.offBoardCombined(gtWealth, _alice);
        _aliceSet = true;
        
        emit WealthSubmitted(msg.sender, "Alice");
    }

    /**
     * @notice Bob submits his encrypted wealth
     * @param wealth Encrypted input (itUint64) representing Bob's wealth
     */
    function setBobWealth(itUint64 calldata wealth) external {
        require(msg.sender == _bob, "Only Bob can set his wealth");
        require(!_bobSet, "Bob's wealth already set");
        
        gtUint64 gtWealth = MpcCore.validateCiphertext(wealth);
        _bobWealth = MpcCore.offBoardCombined(gtWealth, _bob);
        _bobSet = true;
        
        emit WealthSubmitted(msg.sender, "Bob");
    }

    /**
     * @notice Perform the comparison and store encrypted results for both parties
     * @dev Can be called by either Alice or Bob once both have submitted their wealth
     * @dev Result: true = you're richer, false = you're not (or tie)
     */
    function compareWealth() external {
        // Validation
        require(_aliceSet && _bobSet, "Both parties must submit their wealth first");

        // Load encrypted wealth
        gtUint64 aliceWealth = MpcCore.onBoard(_aliceWealth.ciphertext);
        gtUint64 bobWealth = MpcCore.onBoard(_bobWealth.ciphertext);

        // Perform comparison: ONLY check if Alice is richer
        // true  = Alice > Bob
        // false = Alice <= Bob
        gtBool aliceRicher = MpcCore.gt(aliceWealth, bobWealth);

        // Store the SAME boolean result for both parties
        _aliceResult = MpcCore.offBoardCombined(aliceRicher, _alice);
        _bobResult = MpcCore.offBoardCombined(aliceRicher, _bob);
        
        emit ComparisonCompleted(msg.sender);
    }

    /**
     * @notice Returns the encrypted comparison result for Alice
     * @return The encrypted result as ctBool (true = Alice is richer, false = not richer or tie)
     */
    function getAliceResult() public view returns (ctBool) {
        require(msg.sender == _alice, "Only Alice can view her result");
        return _aliceResult.userCiphertext;
    }

    /**
     * @notice Returns the encrypted comparison result for Bob
     * @return The encrypted result as ctBool (true = Bob is richer, false = not richer or tie)
     */
    function getBobResult() public view returns (ctBool) {
        require(msg.sender == _bob, "Only Bob can view his result");
        return _bobResult.userCiphertext;
    }

    /**
     * @notice Returns Alice's address
     */
    function getAliceAddress() external view returns (address) {
        return _alice;
    }

    /**
     * @notice Returns Bob's address
     */
    function getBobAddress() external view returns (address) {
        return _bob;
    }

    /**
     * @notice Returns Alice's stored encrypted wealth value
     * @return The encrypted wealth ciphertext
     */
    function getAliceWealth() public view returns (ctUint64) {
        require(_aliceSet, "Alice's wealth not set yet");
        return _aliceWealth.userCiphertext;
    }

    /**
     * @notice Returns Bob's stored encrypted wealth value
     * @return The encrypted wealth ciphertext
     */
    function getBobWealth() public view returns (ctUint64) {
        require(_bobSet, "Bob's wealth not set yet");
        return _bobWealth.userCiphertext;
    }

    /**
     * @notice Reset the contract state (for testing purposes)
     * @dev Can only be called by Alice (contract initiator)
     */
    function reset() external {
        require(msg.sender == _alice, "Only Alice can reset the contract");
        _aliceSet = false;
        _bobSet = false;
    }
}
