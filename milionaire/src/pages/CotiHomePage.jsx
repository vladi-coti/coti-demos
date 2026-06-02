import React from 'react';
import { MillionaireHomePage } from './MillionaireHomePage.jsx';
import { useMillionaireContractCoti } from '../hooks/useMillionaireContractCoti.js';

export default function CotiHomePage() {
    return <MillionaireHomePage useContractHook={useMillionaireContractCoti} network="coti" />;
}
