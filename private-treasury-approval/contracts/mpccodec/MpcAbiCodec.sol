// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@coti-io/coti-contracts/contracts/utils/mpc/MpcCore.sol";

import "../IInbox.sol";

library MpcAbiCodec {
    enum MpcDataType {
        UINT256,
        ADDRESS,
        BYTES32,
        STRING,
        BYTES,
        UINT256_ARRAY,
        ADDRESS_ARRAY,
        BYTES32_ARRAY,
        STRING_ARRAY,
        BYTES_ARRAY,
        IT_BOOL,
        IT_UINT8,
        IT_UINT16,
        IT_UINT32,
        IT_UINT64,
        IT_UINT128,
        IT_UINT256,
        IT_STRING
    }

    struct MpcMethodCallContext {
        IInbox.MpcMethodCall mpcMethodCall;
        bytes[] data;
        uint256 dataSize;
        uint256 argIndex;
    }

    function create(bytes4 selector, uint256 argCount) internal pure returns (MpcMethodCallContext memory) {
        return MpcMethodCallContext({
            mpcMethodCall: IInbox.MpcMethodCall({
                selector: selector,
                data: new bytes(0),
                datatypes: new bytes8[](argCount),
                datalens: new bytes32[](argCount)
            }),
            data: new bytes[](argCount),
            dataSize: 0,
            argIndex: 0
        });
    }

    function addArgument(MpcMethodCallContext memory methodCall, uint256 arg)
        internal
        pure
        returns (MpcMethodCallContext memory)
    {
        return _appendArgument(methodCall, abi.encode(arg), MpcDataType.UINT256);
    }

    function addArgument(MpcMethodCallContext memory methodCall, address arg)
        internal
        pure
        returns (MpcMethodCallContext memory)
    {
        return _appendArgument(methodCall, abi.encode(arg), MpcDataType.ADDRESS);
    }

    function addArgument(MpcMethodCallContext memory methodCall, itBool memory arg)
        internal
        pure
        returns (MpcMethodCallContext memory)
    {
        return _appendArgument(methodCall, abi.encode(arg), MpcDataType.IT_BOOL);
    }

    function build(MpcMethodCallContext memory methodCall) internal pure returns (IInbox.MpcMethodCall memory) {
        bytes memory resized = new bytes(methodCall.dataSize);
        uint256 cursor = 0;

        for (uint256 i = 0; i < methodCall.argIndex; i++) {
            bytes memory chunk = methodCall.data[i];
            methodCall.mpcMethodCall.datalens[i] = bytes32(chunk.length);

            for (uint256 j = 0; j < chunk.length; j++) {
                resized[cursor + j] = chunk[j];
            }

            cursor += chunk.length;
        }

        methodCall.mpcMethodCall.data = resized;
        return methodCall.mpcMethodCall;
    }

    function _appendArgument(
        MpcMethodCallContext memory methodCallContext,
        bytes memory encodedArg,
        MpcDataType dataType
    ) private pure returns (MpcMethodCallContext memory) {
        require(methodCallContext.argIndex < methodCallContext.mpcMethodCall.datatypes.length, "MpcAbiCodec: too many args");

        methodCallContext.mpcMethodCall.datatypes[methodCallContext.argIndex] = bytes8(uint64(uint8(dataType)));
        methodCallContext.data[methodCallContext.argIndex] = encodedArg;
        methodCallContext.dataSize += encodedArg.length;
        methodCallContext.argIndex += 1;

        return methodCallContext;
    }
}
