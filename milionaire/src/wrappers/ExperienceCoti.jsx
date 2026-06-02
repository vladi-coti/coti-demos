import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';

const CotiHomePage = lazy(() => import('../pages/CotiHomePage.jsx'));

const Fallback = styled.div`
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${(p) => p.theme.colors.text.default};
    font-size: 1rem;
`;

export default function ExperienceCoti() {
    return (
        <Suspense fallback={<Fallback>Loading COTI Testnet demo…</Fallback>}>
            <CotiHomePage />
        </Suspense>
    );
}
