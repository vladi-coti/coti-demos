import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
    COTI_TESTNET_CHAIN_ID,
    SEPOLIA_CHAIN_ID,
} from '../lib/pod/defaults.js';
import { AVALANCHE_FUJI_CHAIN_ID } from '../lib/pod/network.js';
import {
    createMillionairePodRequest,
    findExecutionErrorInTree,
    isPodTrackComplete,
} from '../lib/pod/requestTrack.js';

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.65; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(30, 41, 246, 0.35); }
  50% { box-shadow: 0 0 0 8px rgba(30, 41, 246, 0); }
`;

const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: radial-gradient(
            ellipse 120% 80% at 50% 18%,
            rgba(30, 41, 246, 0.22),
            rgba(0, 0, 0, 0.78)
        ),
        rgba(0, 0, 0, 0.52);
    backdrop-filter: blur(12px);
`;

const Panel = styled.div`
    width: 100%;
    max-width: 560px;
    border-radius: 22px;
    padding: 1.75rem 1.5rem 1.5rem;
    background: ${({ theme }) => theme.colors.card.default};
    box-shadow:
        0 28px 90px rgba(0, 0, 0, 0.48),
        0 0 0 1px rgba(255, 255, 255, 0.07) inset;
    text-align: center;
`;

const Title = styled.h2`
    margin: 0 0 0.25rem;
    font-size: 1.2rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text.default};
    letter-spacing: 0.03em;
`;

const Sub = styled.p`
    margin: 0 0 1.35rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.text.default};
    opacity: 0.72;
`;

const StepperOuter = styled.div`
    margin: 0.25rem 0 1.25rem;
    padding: 0.5rem 0.25rem 0.25rem;
`;

const StepperTrack = styled.ol`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    position: relative;
    gap: 0.25rem;

    ${({ theme }) => theme.mediaQueries.small} {
        flex-direction: column;
        align-items: stretch;
        gap: 0;
    }
`;

const Connector = styled.div`
    position: absolute;
    top: 22px;
    left: 12%;
    right: 12%;
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(
        90deg,
        rgba(30, 41, 246, 0.15),
        rgba(30, 41, 246, 0.35),
        rgba(30, 41, 246, 0.15)
    );
    z-index: 0;
    pointer-events: none;

    ${({ theme }) => theme.mediaQueries.small} {
        display: none;
    }
`;

const ConnectorFill = styled.div`
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, #1e29f6, #6b7cff);
    transform-origin: left center;
    transform: scaleX(${(p) => p.$progress});
    transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.9;
`;

const StepItem = styled.li`
    flex: 1;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;

    ${({ theme }) => theme.mediaQueries.small} {
        flex-direction: row;
        align-items: center;
        padding: 0.35rem 0;
        border-left: 3px solid rgba(30, 41, 246, 0.2);
        margin-left: 0.5rem;
        padding-left: 0.75rem;
    }
`;

const StepHit = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 0.35rem 0.2rem 0.15rem;
    border-radius: 14px;
    cursor: default;
    transition:
        background 0.22s ease,
        transform 0.22s ease,
        box-shadow 0.22s ease;

    &:hover {
        background: rgba(30, 41, 246, 0.07);
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(30, 41, 246, 0.12);
    }

    ${({ theme }) => theme.mediaQueries.small} {
        flex-direction: row;
        align-items: center;
        gap: 0.75rem;
        padding: 0.45rem 0.5rem;
    }
`;

const iconRing = (state) => {
    if (state === 'done')
        return css`
            background: linear-gradient(145deg, #22c55e, #16a34a);
            color: #fff;
            border: 2px solid rgba(255, 255, 255, 0.35);
        `;
    if (state === 'error')
        return css`
            background: linear-gradient(145deg, #f87171, #ef4444);
            color: #fff;
            border: 2px solid rgba(255, 255, 255, 0.35);
        `;
    if (state === 'active')
        return css`
            background: linear-gradient(145deg, #6b7cff, #1e29f6);
            color: #fff;
            border: 2px solid rgba(255, 255, 255, 0.45);
            animation: ${pulse} 1.8s ease-in-out infinite, ${glow} 2.2s ease-out infinite;
        `;
    return css`
        background: ${(p) => p.theme.colors.background.alternative};
        color: ${(p) => p.theme.colors.icon.alternative};
        border: 2px solid rgba(19, 22, 24, 0.08);
    `;
};

const StepIconWrap = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition:
        transform 0.22s ease,
        filter 0.22s ease;

    ${(p) => iconRing(p.$state)}

    svg {
        width: 22px;
        height: 22px;
        display: block;
    }

    ${StepHit}:hover & {
        transform: scale(1.06);
        filter: brightness(1.05);
    }
`;

const StepLabel = styled.span`
    margin-top: 0.45rem;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.text.default};
    opacity: ${(p) => (p.$state === 'pending' ? 0.45 : 0.92)};
    line-height: 1.2;
    text-align: center;
    max-width: 5.5rem;

    ${({ theme }) => theme.mediaQueries.small} {
        margin-top: 0;
        text-align: left;
        max-width: none;
    }
`;

const StepHint = styled.span`
    display: block;
    margin-top: 0.15rem;
    font-size: 0.62rem;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.55;
    color: ${({ theme }) => theme.colors.text.default};
    max-width: 6.5rem;

    ${({ theme }) => theme.mediaQueries.small} {
        max-width: none;
    }
`;

const ErrBox = styled.div`
    margin: 0.35rem 0 0.75rem;
    padding: 0.6rem 0.65rem;
    border-radius: 10px;
    text-align: left;
    background: ${({ theme }) => theme.colors.error?.default10 || 'rgba(248, 110, 110, 0.15)'};
    color: ${({ theme }) => theme.colors.error?.default || '#c62828'};
    font-size: 0.75rem;
    line-height: 1.4;
`;

const IdBox = styled.div`
    font-family: ${({ theme }) => theme.fonts.code};
    font-size: 0.68rem;
    word-break: break-all;
    padding: 0.65rem 0.75rem;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(30, 41, 246, 0.12);
    color: ${({ theme }) => theme.colors.text.default};
    margin-bottom: 0.85rem;
    text-align: left;
`;

const IdLink = styled.a`
    color: ${({ theme }) => theme.colors.text.link};
    text-decoration: none;
    font-weight: 500;
    border-bottom: 1px solid rgba(30, 41, 246, 0.35);
    &:hover {
        color: ${({ theme }) => theme.colors.primary.hover};
    }
`;

const Bar = styled.div`
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(
        90deg,
        rgba(30, 41, 246, 0.12),
        rgba(30, 41, 246, 0.75),
        rgba(30, 41, 246, 0.12)
    );
    background-size: 200% 100%;
    animation: ${shimmer} 2.4s ease-in-out infinite;
`;

const Foot = styled.p`
    margin: 0.85rem 0 0;
    font-size: 0.72rem;
    opacity: 0.52;
    color: ${({ theme }) => theme.colors.text.default};
`;

function IconTx() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
            <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinecap="round" />
        </svg>
    );
}

function IconInbox() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path d="M4 6h16v12H4V6z" strokeLinejoin="round" />
            <path d="M4 10l8 5 8-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconLink() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path d="M10 13a5 5 0 010-7l1-1a5 5 0 017 7l-1 1" strokeLinecap="round" />
            <path d="M14 11a5 5 0 010 7l-1 1a5 5 0 01-7-7l1-1" strokeLinecap="round" />
        </svg>
    );
}

function IconCpu() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <rect x="5" y="5" width="14" height="14" rx="2" />
            <path d="M9 9h6v6H9z" />
            <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" strokeLinecap="round" />
        </svg>
    );
}

function IconCheck() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconAlert() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M12 8v5M12 17h.01" strokeLinecap="round" />
            <path d="M10.3 3.6L2.6 17a2 2 0 001.7 3h14.4a2 2 0 001.7-3L13.7 3.6a2 2 0 00-3.4 0z" strokeLinejoin="round" />
        </svg>
    );
}

const STEPS_META = [
    {
        key: 'sealed',
        label: 'Sealed',
        hint: 'Compare tx on Sepolia',
        title:
            'Your compare transaction is confirmed. The millionaire contract registered two outbound PoD legs; we track the Bob (2nd) request id.',
        Icon: IconTx,
    },
    {
        key: 'inbox',
        label: 'Inbox',
        hint: 'Sepolia outbound row',
        title:
            'The Sepolia PoD inbox has a stored request row for this id (see pod-request.ts: source.requests on chain ' +
            SEPOLIA_CHAIN_ID +
            ').',
        Icon: IconInbox,
    },
    {
        key: 'relay',
        label: 'Relay',
        hint: 'Seen on COTI inbox',
        title:
            'Target inbox ingested this request (minedOnTarget). Relayers mirror the payload to COTI testnet (chain ' +
            COTI_TESTNET_CHAIN_ID +
            ').',
        Icon: IconLink,
    },
    {
        key: 'mpc',
        label: 'Remote',
        hint: 'MPC on COTI',
        title:
            'Privacy on Demand executes the garbled circuit on COTI. Target-side errors appear as execution in the tracker tree.',
        Icon: IconCpu,
    },
    {
        key: 'done',
        label: 'Callback',
        hint: 'Inbox → contract',
        title:
            'When the inbox marks this outbound request executed, the callback to your contract has been delivered for this leg.',
        Icon: IconCheck,
    },
];

/**
 * @param {import('../lib/pod/requestTrack.js').RequestTrackingResponse | null} track
 * @param {boolean} hasExecErr
 * @returns {{ states: ('pending'|'active'|'done'|'error')[], progress: number }}
 */
function stepStatesFromTrack(track, hasExecErr) {
    /** @type {('pending'|'active'|'done'|'error')[]} */
    const states = STEPS_META.map(() => 'pending');

    if (hasExecErr) {
        states[0] = 'done';
        states[1] = 'done';
        states[2] = 'done';
        states[3] = 'error';
        states[4] = 'pending';
        return { states, progress: 0.38 };
    }

    if (!track) {
        states[0] = 'active';
        return { states, progress: 0.08 };
    }

    states[0] = 'done';
    states[1] = 'done';

    if (!track.minedOnTarget) {
        states[2] = 'active';
        return { states, progress: 0.28 };
    }

    states[2] = 'done';

    if (!track.executed) {
        states[3] = 'active';
        return { states, progress: 0.58 };
    }

    states[3] = 'done';

    if (isPodTrackComplete(track)) {
        states[4] = 'done';
        return { states, progress: 1 };
    }

    states[4] = 'active';
    return { states, progress: 0.88 };
}

/**
 * Full-screen overlay: polls {@link https://github.com/cotitech-io/coti-pod-sdk/blob/main/src/pod-request.ts PodRequest.trackRequest}
 * (app chain + COTI inboxes) until the request tree completes or reports an execution error.
 */
export function PodRequestTracker({
    appChainId = SEPOLIA_CHAIN_ID,
    appInboxAddress,
    appRpcUrl,
    requestIdBob,
    inboxExplorerUrl,
    podRequestExplorerUrl,
    onSettled,
}) {
    const trackChainId =
        appChainId === SEPOLIA_CHAIN_ID || appChainId === AVALANCHE_FUJI_CHAIN_ID
            ? appChainId
            : SEPOLIA_CHAIN_ID;
    const [track, setTrack] = useState(null);
    const [pollError, setPollError] = useState(null);
    const settledRef = useRef(false);

    const pod = useMemo(
        () =>
            createMillionairePodRequest({
                appChainId: trackChainId,
                appInboxAddress,
                appRpcUrl,
            }),
        [trackChainId, appInboxAddress, appRpcUrl]
    );

    const inboxLink = useMemo(
        () => (inboxExplorerUrl && appInboxAddress ? inboxExplorerUrl(appInboxAddress) : null),
        [appInboxAddress, inboxExplorerUrl]
    );

    const podExplorerHref = useMemo(
        () => (podRequestExplorerUrl && requestIdBob ? podRequestExplorerUrl(requestIdBob) : null),
        [podRequestExplorerUrl, requestIdBob]
    );

    const shortId =
        requestIdBob && requestIdBob.length > 18
            ? `${requestIdBob.slice(0, 10)}…${requestIdBob.slice(-8)}`
            : requestIdBob;

    useEffect(() => {
        let cancelled = false;
        const pollMs = 2500;

        async function tick() {
            try {
                const t = await pod.trackRequest(trackChainId, requestIdBob);
                if (cancelled) return;
                setTrack(t);
                setPollError(null);

                const failed = Boolean(findExecutionErrorInTree(t));
                const done = isPodTrackComplete(t);
                if (!settledRef.current && (done || failed)) {
                    settledRef.current = true;
                    onSettled?.({
                        success: done && !failed,
                        failed,
                        execution: failed ? findExecutionErrorInTree(t) : null,
                        track: t,
                    });
                }
            } catch (e) {
                if (cancelled) return;
                const msg = e?.message || String(e);
                if (msg.includes('not found')) {
                    setTrack(null);
                    setPollError(null);
                } else {
                    setPollError(msg);
                    console.error('PodRequestTracker.trackRequest:', e);
                }
            }
        }

        tick();
        const id = setInterval(tick, pollMs);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [pod, trackChainId, requestIdBob, onSettled]);

    const execution = track ? findExecutionErrorInTree(track) : null;
    const hasExecErr = Boolean(execution);
    const { states, progress } = stepStatesFromTrack(track, hasExecErr);
    const complete = track && isPodTrackComplete(track);
    const busy = !hasExecErr && !complete;

    return (
        <Backdrop role="dialog" aria-live="polite" aria-busy={busy}>
            <Panel>
                <Title>Privacy on Demand</Title>
                <Sub>
                    Cross-chain status from{' '}
                    <a
                        href="https://github.com/cotitech-io/coti-pod-sdk/blob/main/src/pod-request.ts"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', fontWeight: 600 }}
                    >
                        PodRequest.trackRequest
                    </a>
                    . Hover a step for details.
                </Sub>

                <StepperOuter>
                    <StepperTrack>
                        <Connector aria-hidden>
                            <ConnectorFill $progress={progress} />
                        </Connector>
                        {STEPS_META.map((step, i) => {
                            const state = states[i];
                            const IconComp = state === 'error' ? IconAlert : step.Icon;
                            return (
                                <StepItem key={step.key}>
                                    <StepHit title={step.title}>
                                        <StepIconWrap $state={state}>
                                            <IconComp />
                                        </StepIconWrap>
                                        <div>
                                            <StepLabel $state={state}>{step.label}</StepLabel>
                                            <StepHint>{step.hint}</StepHint>
                                        </div>
                                    </StepHit>
                                </StepItem>
                            );
                        })}
                    </StepperTrack>
                </StepperOuter>

                {execution && (
                    <ErrBox>
                        <strong>Execution failed.</strong> {execution.errorMessage}
                    </ErrBox>
                )}

                {pollError && (
                    <ErrBox>
                        <strong>RPC error.</strong> {pollError}
                    </ErrBox>
                )}

                <IdBox>
                    <div style={{ opacity: 0.6, fontSize: '0.62rem', marginBottom: '0.3rem' }}>
                        Request id
                    </div>
                    {podExplorerHref ? (
                        <IdLink
                            href={podExplorerHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={requestIdBob}
                        >
                            {shortId}
                        </IdLink>
                    ) : (
                        <span title={requestIdBob}>{shortId}</span>
                    )}
                </IdBox>

                {busy && <Bar aria-hidden />}

                {(inboxLink || !podExplorerHref) && (
                    <Foot>
                        {!podExplorerHref && (
                            <span style={{ display: 'block', marginBottom: '0.35rem' }}>
                                Set <code style={{ fontSize: '0.65em' }}>VITE_POD_REQUEST_EXPLORER_URL</code> with{' '}
                                <code style={{ fontSize: '0.65em' }}>{'{requestId}'}</code> for a PoD explorer link.
                            </span>
                        )}
                        {inboxLink && (
                            <a href={inboxLink} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                                Inbox on explorer
                            </a>
                        )}
                    </Foot>
                )}
            </Panel>
        </Backdrop>
    );
}
