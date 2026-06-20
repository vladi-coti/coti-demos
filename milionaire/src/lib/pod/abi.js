/** MillionaireComparisonPod — pod-mpc-lib flat `itUint256` / `ctUint256`. */
export const MILLIONAIRE_COMPARISON_ABI = [
    'function setAliceWealth(tuple(tuple(uint256 ciphertextHigh, uint256 ciphertextLow) ciphertext, bytes signature) wealth) external',
    'function setBobWealth(tuple(tuple(uint256 ciphertextHigh, uint256 ciphertextLow) ciphertext, bytes signature) wealth) external',
    'function compareWealth(uint256 callbackFeeWei) external payable',
    'function inbox() external view returns (address)',
    'function isAliceWealthSet() external view returns (bool)',
    'function isBobWealthSet() external view returns (bool)',
    'function areBothWealthsSet() external view returns (bool)',
    'function aliceResultReady() external view returns (bool)',
    'function bobResultReady() external view returns (bool)',
    'function getAliceResult() external view returns (uint256)',
    'function getBobResult() external view returns (uint256)',
    'function getAliceAddress() external view returns (address)',
    'function getBobAddress() external view returns (address)',
    'function getAliceWealth() public view returns (tuple(uint256 ciphertextHigh, uint256 ciphertextLow))',
    'function getBobWealth() public view returns (tuple(uint256 ciphertextHigh, uint256 ciphertextLow))',
    'function reset() external',
];
