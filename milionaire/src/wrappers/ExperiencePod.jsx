import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { getPodNetwork } from '../lib/pod/network.js';

const PodHomePage = lazy(() => import('../pages/PodHomePage.jsx'));

const Fallback = styled.div`
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${(p) => p.theme.colors.text.default};
    font-size: 1rem;
`;

/**
 * @param {{ networkId?: 'sepolia' | 'avalanche' }} props
 */
export default function ExperiencePod({ networkId = 'sepolia' }) {
    const label = getPodNetwork(networkId).label;
    return (
        <Suspense fallback={<Fallback>Loading {label} demo…</Fallback>}>
            <PodHomePage networkId={networkId} />
        </Suspense>
    );
}
