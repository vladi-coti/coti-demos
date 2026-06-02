import React, { useMemo } from 'react';
import { MillionaireHomePage } from './MillionaireHomePage.jsx';
import { makeUseMillionaireContractPod } from '../hooks/useMillionaireContractPod.js';

/**
 * @param {{ networkId?: 'sepolia' | 'avalanche' }} props
 */
export default function PodHomePage({ networkId = 'sepolia' }) {
    const useContractHook = useMemo(
        () => makeUseMillionaireContractPod(networkId),
        [networkId],
    );
    return <MillionaireHomePage useContractHook={useContractHook} network={networkId} />;
}
