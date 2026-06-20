import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { AppContainer, CardsContainer, Card, FormGroup, ButtonGroup } from '../components/styles.js';
import { POD_NETWORKS } from '../lib/pod/network.js';

const HeaderTitle = styled.h1`
    color: ${(props) => props.theme.colors.text.default} !important;
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    margin: 0 0 0.5rem 0;

    ${({ theme }) => theme.mediaQueries.small} {
        font-size: 1.2rem;
    }
`;

const HeaderSubTitle = styled.p`
    margin: 0 0 1.25rem 0;
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1.5;
    text-align: center;
    color: ${(props) => props.theme.colors.text.default} !important;
    opacity: 0.9;

    ${({ theme }) => theme.mediaQueries.small} {
        font-size: 0.85rem;
    }
`;

const FormLabel = styled.label`
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.default};
    font-size: 0.85rem;
    white-space: nowrap;
    flex-shrink: 0;
`;

const SelectField = styled.select`
    width: 100%;
    padding: 0.75rem;
    border: 2px solid
        ${(props) =>
            props.theme.colors.text.default === '#FFFFFF'
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(0, 0, 0, 0.2)'};
    border-radius: 12px;
    font-size: 0.85rem;
    font-family: ${({ theme }) => theme.fonts.default};
    transition: border-color 0.3s ease, background-color 0.3s ease;
    background-color: ${(props) =>
        props.theme.colors.text.default === '#FFFFFF'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.05)'};
    color: ${(props) => props.theme.colors.text.default};
    cursor: pointer;

    &:focus {
        outline: none;
        border-color: ${(props) => props.theme.colors.primary.default};
        box-shadow: 0 0 0 3px ${(props) => props.theme.colors.secondary.default10};
        background-color: ${(props) =>
            props.theme.colors.text.default === '#FFFFFF'
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.08)'};
    }
`;

const PrimaryButton = styled.button`
    background-color: #1e29f6;
    border: none;
    border-radius: 12px;
    padding: 0.5rem 1rem;
    font-family: ${({ theme }) => theme.fonts.default};
    font-size: 0.85rem;
    font-weight: 500;
    color: #ffffff;
    flex: 1;
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    &:hover:not(:disabled) {
        background-color: rgba(30, 41, 246, 0.8);
        transform: translateY(-1px);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
        background-color: rgba(30, 41, 246, 0.8);
    }
`;

const Hint = styled.p`
    margin: 1.25rem 0 0 0;
    font-size: 0.75rem;
    line-height: 1.5;
    text-align: center;
    color: ${(props) => props.theme.colors.text.default} !important;
    opacity: 0.85;

    code {
        font-size: 0.7rem;
        word-break: break-all;
    }
`;

export default function ChainSelectPage() {
    const navigate = useNavigate();
    const [chain, setChain] = useState('coti');

    const openDemo = () => {
        if (chain === 'coti') {
            navigate('/coti');
        } else if (chain === 'avalanche') {
            navigate('/avalanche');
        } else {
            navigate('/sepolia');
        }
    };

    return (
        <AppContainer>
            <CardsContainer
                style={{
                    marginTop: 0,
                    marginBottom: '2rem',
                    maxWidth: '420px',
                    width: '100%',
                }}
            >
                <Card $maxWidth="100%" $width="100%" style={{ padding: '1.5rem', minWidth: 0 }}>
                    <HeaderTitle>Choose network</HeaderTitle>
                    <HeaderSubTitle>
                        Same Millionaires&apos; Problem demo: native MPC on COTI Testnet, or Privacy on Demand (PoD) on
                        Sepolia or Avalanche Fuji — same UI and contract flow, different app chain.
                    </HeaderSubTitle>
                    <FormGroup
                        style={{
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                        }}
                    >
                        <FormLabel htmlFor="chain-select">Network</FormLabel>
                        <SelectField
                            id="chain-select"
                            value={chain}
                            onChange={(e) => setChain(e.target.value)}
                            aria-label="Select demo network"
                        >
                            <option value="coti">COTI Testnet (native MPC)</option>
                            <option value="sepolia">{POD_NETWORKS.sepolia.label}</option>
                            <option value="avalanche">{POD_NETWORKS.avalanche.label}</option>
                        </SelectField>
                    </FormGroup>
                    <ButtonGroup style={{ justifyContent: 'center' }}>
                        <PrimaryButton type="button" onClick={openDemo}>
                            Open demo
                        </PrimaryButton>
                    </ButtonGroup>
                </Card>
            </CardsContainer>
        </AppContainer>
    );
}
