import React, { useState, useEffect, useRef, useCallback } from 'react'
import styled, { keyframes } from 'styled-components'
import IntroModal from '../components/IntroModal.jsx'
import { PodRequestTracker } from '../components/PodRequestTracker.jsx'
import { isPodDemoNetwork, POD_NETWORKS, getPodNetwork } from '../lib/podNetworkConfig.js'

const EXPLORER = {
    coti: {
        tx: (hash) => `https://testnet.cotiscan.io/tx/${hash}`,
        address: (addr) => `https://testnet.cotiscan.io/address/${addr}`,
    },
    sepolia: POD_NETWORKS.sepolia.explorer,
    avalanche: POD_NETWORKS.avalanche.explorer,
}

import {
    AppContainer,
    CardsContainer,
    Card,
    FormGroup,
    StatusMessage,
    InfoBox,
    InfoTitle,
    InfoText,
    List,
    ListItem,
    Link,
    ButtonGroup
} from '../components/styles.js'

/** Used on PoD pages (`/sepolia`, `/avalanche`) — decimal wealth UI and `millionaireWealthEncrypt`. */
const WEALTH_DECIMALS = (() => {
    const n = Number(import.meta.env.VITE_WEALTH_DECIMALS)
    return Number.isFinite(n) && n >= 0 && n <= 78 ? n : 18
})()

const Title = styled.h1`
  color: ${props => props.theme.colors.text.default} !important;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: left;
  margin: 0 0 0.5rem 0;

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 1.1rem;
  }
`;

const SubTitle = styled.h2`
  color: ${props => props.theme.colors.text.default} !important;
  font-size: 1.1rem;
  font-weight: 400;
  text-align: left;
  margin: 0 0 1rem 0;

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 1.1rem;
  }
`;

const CardTitle = styled.h3`
  color: ${props => props.theme.colors.text.default} !important;
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
`;

const PlayerName = styled.h3`
  color: ${props => props.theme.colors.text.default} !important;
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
`;

const PlayerAddress = styled.div`
  font-size: 0.6rem;
  font-style: normal;
  color: ${props => props.theme.colors.text.default} !important;
  word-break: break-all;
  text-align: left;
  width: 100%;

  a {
    font-style: normal !important;
  }
`;

const PlayerFormLabel = styled.label`
  font-weight: 600;
  color: ${props => props.theme.colors.text.default};
  font-size: 0.85rem;
  white-space: nowrap;
  flex-shrink: 0;

  ${({ theme }) => theme.mediaQueries.small} {
    margin-bottom: 0.5rem;
  }
`;

const PlayerButton = styled.button`
  background-color: #1E29F6;
  border: none;
  border-radius: 12px;
  padding: 0.5rem 1rem;
  font-family: ${({ theme }) => theme.fonts.default};
  font-size: 0.85rem;
  font-weight: 500;
  color: #FFFFFF;
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

const PlayerFormInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid ${(props) =>
        props.theme.colors.text.default === '#FFFFFF'
            ? 'rgba(255, 255, 255, 0.2)'
            : 'rgba(0, 0, 0, 0.2)'};
  border-radius: 12px;
  font-size: 0.85rem;
  transition: border-color 0.3s ease, background-color 0.3s ease;
  background-color: ${(props) =>
        props.theme.colors.text.default === '#FFFFFF'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.05)'};
  color: ${(props) => props.theme.colors.text.default};

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primary.default};
    box-shadow: 0 0 0 3px ${(props) => props.theme.colors.secondary.default10};
    background-color: ${(props) =>
        props.theme.colors.text.default === '#FFFFFF'
            ? 'rgba(255, 255, 255, 0.15)'
            : 'rgba(0, 0, 0, 0.08)'};
  }

  &::placeholder {
    color: ${(props) =>
        props.theme.colors.text.default === '#FFFFFF'
            ? 'rgba(255, 255, 255, 0.5)'
            : 'rgba(0, 0, 0, 0.4)'};
  }
`;

const AmountHint = styled.p`
  margin: 0.35rem 0 0 0;
  font-size: 0.65rem;
  line-height: 1.35;
  color: ${(props) =>
        props.theme.colors.text.default === '#FFFFFF'
            ? 'rgba(255, 255, 255, 0.65)'
            : 'rgba(0, 0, 0, 0.55)'};
  text-align: left;
`;

const PlayerSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 0;
  align-items: stretch;

  > * {
    height: 100%;
  }

  @media screen and (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const ResultBox = styled.div`
  word-break: break-all;
  font-size: 0.7rem;
  font-family: ${({ theme }) => theme.fonts.default};
  padding: 0.75rem;
  background-color: ${props => props.theme.colors.secondary.default10};
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 1px solid ${props => props.theme.colors.primary.default};
  color: ${props => props.theme.colors.text.default} !important;
  line-height: 1.4;
  text-align: left;
`;

const MonospaceText = styled.div`
  font-family: ${({ theme }) => theme.fonts.default};
  font-size: 0.7rem;
  margin-top: 0.5rem;
  color: ${props => props.theme.colors.text.default} !important;
  line-height: 1.3;
  opacity: 0.85;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const ContractDetail = styled.p`
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: ${props => props.theme.colors.text.default} !important;
  line-height: 1.8;

  &:last-child {
    margin-bottom: 0;
  }
`;

const CompareSection = styled.div`
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
`;

const SmallButton = styled.button`
  background-color: #1E29F6;
  border: none;
  border-radius: 12px;
  padding: 0.5rem 1rem;
  font-family: ${({ theme }) => theme.fonts.default};
  font-size: 0.85rem;
  font-weight: 500;
  color: #FFFFFF;
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

const ContractRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const HeaderTitle = styled.h1`
  color: ${props => props.theme.colors.text.default} !important;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  margin: 0;

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 1.2rem;
  }
`;

const HeaderSubTitle = styled.h2`
  color: ${props => props.theme.colors.text.default} !important;
  font-size: 0.95rem;
  font-weight: 400;
  text-align: center;
  margin: 0.5rem 0 1rem 0;
  opacity: 0.9;

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 0.85rem;
  }
`;

const HeaderContract = styled.p`
  margin: 0;
  font-size: 0.8rem;
  color: ${props => props.theme.colors.text.default} !important;
  text-align: center;
`;

const InfoIcon = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.text.default};
  cursor: pointer;
  font-size: 1.5rem;
  padding: 0.25rem;
  transition: all 0.2s ease-in-out;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  ${({ theme }) => theme.mediaQueries.small} {
    font-size: 1.2rem;
  }
`;

const BottomStatusBar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background-color: ${props => {
        if (props.$variant === 'success') return props.theme.colors.secondary.default10;
        if (props.$variant === 'error') return props.theme.colors.error.default10;
        return 'rgba(128, 128, 128, 0.2)';
    }};
  color: ${props => {
        if (props.$variant === 'success') return props.theme.colors.primary.default;
        if (props.$variant === 'error') return props.theme.colors.error.default;
        return props.theme.colors.text.default;
    }};
  border-top: 2px solid ${props => {
        if (props.$variant === 'success') return props.theme.colors.primary.default;
        if (props.$variant === 'error') return props.theme.colors.error.default;
        return 'rgba(128, 128, 128, 0.3)';
    }};
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 999;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 500;
  backdrop-filter: blur(10px);
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
`;

const ModalContent = styled.div`
  background-color: ${props => props.theme.colors.card.default};
  border-radius: 12px;
  padding: 2rem;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: ${props => props.theme.colors.text.default};
  cursor: pointer;
  font-size: 2rem;
  padding: 0.5rem;
  transition: all 0.2s ease-in-out;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    transform: rotate(90deg);
  }
`;

/**
 * @param {object} props
 * @param {() => object} props.useContractHook useMillionaireContractCoti or useMillionaireContractPod
 * @param {'coti' | 'sepolia' | 'avalanche'} props.network
 */
export function MillionaireHomePage({ useContractHook, network }) {
    const ex = EXPLORER[network]
    const pollsMpc = isPodDemoNetwork(network)
    const podDecimalWealthUi = pollsMpc

    const {
        submitAliceWealth,
        submitBobWealth,
        performComparison,
        getFullComparisonResult,
        checkWealthStatus,
        getEncryptedAliceWealth,
        getEncryptedBobWealth,
        resetContract,
        contractAddress,
        podRpcUrl,
        sepoliaRpcUrl,
        podAppChainId,
        aliceWallet,
        bobWallet
    } = useContractHook()

    const podChainRpcUrl = podRpcUrl ?? sepoliaRpcUrl

    // Alice state
    const [aliceWealth, setAliceWealth] = useState('')
    const [aliceLoading, setAliceLoading] = useState(false)
    const [aliceStatus, setAliceStatus] = useState('')
    const [aliceStatusVariant, setAliceStatusVariant] = useState('info')
    const [aliceResult, setAliceResult] = useState(null)
    const [aliceSubmitted, setAliceSubmitted] = useState(false)

    // Bob state
    const [bobWealth, setBobWealth] = useState('')
    const [bobLoading, setBobLoading] = useState(false)
    const [bobStatus, setBobStatus] = useState('')
    const [bobStatusVariant, setBobStatusVariant] = useState('info')
    const [bobResult, setBobResult] = useState(null)
    const [bobSubmitted, setBobSubmitted] = useState(false)

    // Shared state
    const [connectionStatus, setConnectionStatus] = useState('')
    const [globalLoading, setGlobalLoading] = useState(false)
    const [podTracker, setPodTracker] = useState(null)
    const podWaitRef = useRef(null)
    const [showInfoModal, setShowInfoModal] = useState(false)
    const [showComparisonModal, setShowComparisonModal] = useState(false)
    const [comparisonResult, setComparisonResult] = useState(null)

    // Re-run when wallets hydrate (useLayoutEffect in contract hooks) or contract address changes.
    useEffect(() => {
        checkContractConnection()
        // checkContractConnection uses hook methods; deps capture wallet / contract readiness.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aliceWallet, bobWallet, contractAddress, network])

    const handlePodTrackerSettled = useCallback(() => {
        setPodTracker(null)
        const r = podWaitRef.current
        podWaitRef.current = null
        r?.()
    }, [])

    const checkContractConnection = async () => {
        setConnectionStatus('🔄 Checking contract connection...')

        try {
            if (!contractAddress) {
                const hint =
                    network === 'coti'
                        ? 'VITE_CONTRACT_ADDRESS_COTI_TESTNET (or VITE_CONTRACT_ADDRESS)'
                        : getPodNetwork(network).contractAddressHint
                setConnectionStatus(`❌ Contract address not configured. Set ${hint} in .env`)
                return
            }
            if (!aliceWallet) {
                setConnectionStatus(
                    `❌ Alice wallet not configured. Set it in .env (AES key only needed for submit/compare).`
                )
                return
            }

            // Check if wealth already submitted
            const status = await checkWealthStatus()
            setAliceSubmitted(status.aliceSet)
            setBobSubmitted(status.bobSet)
            if (!status.aliceSet) {
                setAliceStatus('')
            }
            if (!status.bobSet) {
                setBobStatus('')
            }

            if (!bobWallet) {
                setConnectionStatus(
                    `⚠️ Bob wallet not configured. Set it in .env. You can still reset the contract with Alice.`
                )
            } else {
                setConnectionStatus('')
            }
        } catch (error) {
            console.error('Error connecting to contract:', error)
            setConnectionStatus('❌ Error connecting to contract: ' + error.message)
        }
    }

    // Callback when IntroModal closes after resetting contract
    const handleIntroModalClose = () => {
        // Reset all local state to match the reset contract
        setAliceSubmitted(false)
        setBobSubmitted(false)
        setAliceWealth('')
        setBobWealth('')
        setAliceResult(null)
        setBobResult(null)
        setAliceStatus('')
        setBobStatus('')
        setConnectionStatus('')
        console.log('HomePage state reset after IntroModal close')
    }

    const handleSubmitAliceWealth = async () => {
        if (!aliceWealth) {
            setAliceStatus("Please enter Alice's wealth amount")
            setAliceStatusVariant('error')
            return
        }

        setAliceLoading(true)
        setAliceStatus('Encrypting wealth and storing on smart contract...')
        setAliceStatusVariant('info')

        try {
            const result = await submitAliceWealth(aliceWealth)
            const txHash = result.receipt.hash
            const explorerLink = ex.tx(txHash)

            let blockchainWealth = null
            if (!pollsMpc) {
                try {
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    blockchainWealth = await getEncryptedAliceWealth()
                } catch (fetchError) {
                    console.error('Error fetching Alice blockchain wealth:', fetchError)
                    blockchainWealth = 'Error fetching'
                }
            }

            setAliceStatus(
                <ResultBox>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <strong>✅ Wealth Submitted Successfully!</strong>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <strong>Wealth Value (Stored on Smart Contract):</strong>
                        <MonospaceText>
                            {result.encryptedCiphertext || 'Loading...'}  🔒
                        </MonospaceText>
                    </div>
                    {!pollsMpc && (
                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong>Encrypted Wealth Blockchain (Ciphertext):</strong>
                            <MonospaceText>
                                {blockchainWealth}
                            </MonospaceText>
                        </div>
                    )}
                    <div>
                        <strong>Transaction:</strong>
                        <MonospaceText>
                            <Link href={explorerLink} target="_blank" rel="noopener noreferrer">
                                {txHash}
                            </Link>
                        </MonospaceText>
                    </div>
                </ResultBox>
            )
            setAliceStatusVariant('success')
            setAliceSubmitted(true)
        } catch (error) {
            console.error('Error submitting Alice wealth:', error)
            setAliceStatus('❌ Error submitting wealth: ' + (error.message || error.toString()))
            setAliceStatusVariant('error')
        } finally {
            setAliceLoading(false)
        }
    }

    const handleSubmitBobWealth = async () => {
        if (!bobWealth) {
            setBobStatus("Please enter Bob's wealth amount")
            setBobStatusVariant('error')
            return
        }

        setBobLoading(true)
        setBobStatus('Encrypting wealth and storing on smart contract...')
        setBobStatusVariant('info')

        try {
            const result = await submitBobWealth(bobWealth)
            const txHash = result.receipt.hash
            const explorerLink = ex.tx(txHash)

            let blockchainWealth = null
            if (!pollsMpc) {
                try {
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    blockchainWealth = await getEncryptedBobWealth()
                } catch (fetchError) {
                    console.error('Error fetching Bob blockchain wealth:', fetchError)
                    blockchainWealth = 'Error fetching'
                }
            }

            setBobStatus(
                <ResultBox>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <strong>✅ Wealth Submitted Successfully!</strong>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <strong>Wealth Value (Stored on Smart Contract):</strong>
                        <MonospaceText>
                            {result.encryptedCiphertext || 'Loading...'}  🔒
                        </MonospaceText>
                    </div>
                    {!pollsMpc && (
                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong>Encrypted Wealth Blockchain (Ciphertext):</strong>
                            <MonospaceText>
                                {blockchainWealth}
                            </MonospaceText>
                        </div>
                    )}
                    <div>
                        <strong>Transaction:</strong>
                        <MonospaceText>
                            <Link href={explorerLink} target="_blank" rel="noopener noreferrer">
                                {txHash}
                            </Link>
                        </MonospaceText>
                    </div>
                </ResultBox>
            )
            setBobStatusVariant('success')
            setBobSubmitted(true)
        } catch (error) {
            console.error('Error submitting Bob wealth:', error)
            setBobStatus('❌ Error submitting wealth: ' + (error.message || error.toString()))
            setBobStatusVariant('error')
        } finally {
            setBobLoading(false)
        }
    }

    const handleCompareAlice = async () => {
        setGlobalLoading(true)
        if (pollsMpc) {
            setConnectionStatus('Performing comparison...')
        } else {
            setConnectionStatus('🔄 Performing comparison...')
        }

        try {
            const comparisonTx = await performComparison(aliceWallet, 'Alice')
            if (pollsMpc) {
                setConnectionStatus('')
            }
            if (
                pollsMpc &&
                comparisonTx.podTrackRequestId &&
                comparisonTx.podInboxAddress &&
                podChainRpcUrl
            ) {
                await new Promise((resolve) => {
                    podWaitRef.current = resolve
                    setPodTracker({
                        inboxAddress: comparisonTx.podInboxAddress,
                        requestIdBob: comparisonTx.podTrackRequestId,
                    })
                })
            }

            const result = await getFullComparisonResult()

            const txHash = comparisonTx.transaction.hash
            const explorerLink = ex.tx(txHash)

            setComparisonResult({
                text: result.text,
                winner: result.winner,
                txHash: txHash,
                explorerLink: explorerLink
            })
            setShowComparisonModal(true)
            if (!pollsMpc) {
                setConnectionStatus('')
            }
        } catch (error) {
            console.error('Error performing comparison:', error)
            setConnectionStatus('❌ Error performing comparison: ' + (error.message || error.toString()))
            setTimeout(() => setConnectionStatus(''), 5000)
        } finally {
            setGlobalLoading(false)
        }
    }

    const handleCompareBob = async () => {
        setBobLoading(true)
        setBobStatus('Performing comparison...')
        setBobStatusVariant('info')

        try {
            const comparisonTx = await performComparison(bobWallet, 'Bob')
            if (pollsMpc) {
                setBobStatus('')
            }
            if (
                pollsMpc &&
                comparisonTx.podTrackRequestId &&
                comparisonTx.podInboxAddress &&
                podChainRpcUrl
            ) {
                await new Promise((resolve) => {
                    podWaitRef.current = resolve
                    setPodTracker({
                        inboxAddress: comparisonTx.podInboxAddress,
                        requestIdBob: comparisonTx.podTrackRequestId,
                    })
                })
            }

            const result = await getFullComparisonResult()

            const txHash = comparisonTx.transaction.hash
            const explorerLink = ex.tx(txHash)

            setBobStatus(
                <ResultBox>
                    <div style={{ marginBottom: '1rem' }}>
                        <strong>🎯 Comparison Result:</strong>
                        <div style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>
                            {result.text}
                        </div>
                    </div>
                    <div>
                        <strong>Transaction:</strong>
                        <MonospaceText>
                            <Link href={explorerLink} target="_blank" rel="noopener noreferrer">
                                {txHash}
                            </Link>
                        </MonospaceText>
                    </div>
                </ResultBox>
            )
            setBobStatusVariant('success')
        } catch (error) {
            console.error('Error performing comparison:', error)
            setBobStatus('❌ Error: ' + (error.message || error.toString()))
            setBobStatusVariant('error')
        } finally {
            setBobLoading(false)
        }
    }

    const handleReset = async () => {
        // Confirmation dialog
        const confirmReset = window.confirm(
            '⚠️ Reset Contract?\n\n' +
            'This will clear all submitted wealth values and allow you to start a new comparison.\n\n' +
            'Both Alice and Bob will need to submit their wealth again.\n\n' +
            'Do you want to continue?'
        )

        if (!confirmReset) {
            return
        }

        setGlobalLoading(true)
        setConnectionStatus('🔄 Resetting contract... (this may take a few seconds)')

        try {
            console.log('Initiating contract reset...')

            // The resetContract function already has retry logic with exponential backoff
            const resetResult = await resetContract()
            console.log('Reset transaction completed:', resetResult.receipt?.hash)

            // Verify the reset was successful by checking wealth status
            console.log('Verifying contract reset...')
            const status = await checkWealthStatus()

            if (status.aliceSet || status.bobSet) {
                throw new Error('Contract reset verification failed - wealth values still set')
            }

            console.log('Contract reset verified - both wealth values cleared')

            // Clear all local state
            setAliceSubmitted(false)
            setBobSubmitted(false)
            setAliceWealth('')
            setBobWealth('')
            setAliceResult(null)
            setBobResult(null)
            setAliceStatus('')
            setBobStatus('')

            setConnectionStatus('✅ Contract reset successfully! You can now submit new wealth values.')

            // Auto-clear success message after 5 seconds
            setTimeout(() => {
                setConnectionStatus('')
            }, 5000)

        } catch (error) {
            console.error('Error resetting contract:', error)

            // Enhanced error messaging
            let errorMessage = '❌ Failed to reset contract. '

            if (error.message) {
                if (error.message.includes('Only Alice can reset')) {
                    errorMessage += 'Only Alice can reset the contract. Please ensure you are using Alice\'s wallet.'
                } else if (error.message.includes('timeout') || error.message.includes('network')) {
                    errorMessage += 'Network timeout. The transaction may still complete - please check the contract status in a moment.'
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage += 'Insufficient gas funds. Please add more test tokens to Alice\'s wallet.'
                } else if (error.message.includes('nonce')) {
                    errorMessage += 'Transaction nonce error. Please try again in a few seconds.'
                } else {
                    errorMessage += error.message
                }
            } else {
                errorMessage += 'Unknown error occurred. Please check console for details.'
            }

            setConnectionStatus(errorMessage)

            // Keep error message visible longer
            setTimeout(() => {
                if (connectionStatus.includes('❌')) {
                    setConnectionStatus('')
                }
            }, 10000)
        } finally {
            setGlobalLoading(false)
        }
    }

    return (
        <AppContainer style={{ justifyContent: 'flex-start', paddingTop: '0' }}>
            <IntroModal onClose={handleIntroModalClose} useContractHook={useContractHook} />

            {/* Info Modal */}
            {showInfoModal && (
                <ModalOverlay onClick={() => setShowInfoModal(false)}>
                    <ModalContent onClick={(e) => e.stopPropagation()}>
                        <CloseButton onClick={() => setShowInfoModal(false)}>×</CloseButton>
                        <InfoBox>
                            <InfoTitle>🔧 How It Works</InfoTitle>
                            <List>
                                <ListItem>
                                    <strong>Step 1:</strong>{' '}
                                    {podDecimalWealthUi ? (
                                        <>
                                            Alice enters a decimal amount; the app converts it to wei ({WEALTH_DECIMALS} decimal
                                            places), encrypts the wei with the MPC service, and submits the ciphertext to the contract
                                        </>
                                    ) : (
                                        <>Alice encrypts her wealth using her private key and submits it to the smart contract</>
                                    )}
                                </ListItem>
                                <ListItem>
                                    <strong>Step 2:</strong>{' '}
                                    {podDecimalWealthUi ? (
                                        <>Bob does the same with his decimal amount</>
                                    ) : (
                                        <>Bob encrypts his wealth using his private key and submits it to the smart contract</>
                                    )}
                                </ListItem>
                                <ListItem>
                                    <strong>Step 3:</strong> Either party triggers the comparison function
                                </ListItem>
                                <ListItem>
                                    <strong>Step 4:</strong> The smart contract performs the comparison using COTI's MPC Core
                                </ListItem>
                                <ListItem>
                                    <strong>Step 5:</strong>{' '}
                                    {pollsMpc
                                        ? 'The app waits until the MPC result is ready (a few minutes), then each party decrypts their result using their AES key to learn who is richer'
                                        : 'Each party can decrypt their own result to learn who is richer'}
                                </ListItem>
                                <ListItem>
                                    <strong>Result:</strong> Both know the comparison result, but neither learns the other's actual wealth! 🎉
                                </ListItem>
                            </List>
                            <InfoText style={{ marginTop: '1.5rem' }}>
                                <strong>Key Features:</strong>
                            </InfoText>
                            <List>
                                <ListItem>✅ Privacy-preserving comparison</ListItem>
                                <ListItem>✅ On-chain computation with encrypted data</ListItem>
                                <ListItem>✅ No trusted third party required</ListItem>
                                <ListItem>✅ Mathematically proven security using MPC</ListItem>
                            </List>
                        </InfoBox>
                    </ModalContent>
                </ModalOverlay>
            )}

            {/* Comparison Result Modal */}
            {showComparisonModal && comparisonResult && (
                <ModalOverlay onClick={() => setShowComparisonModal(false)}>
                    <ModalContent onClick={(e) => e.stopPropagation()}>
                        <CloseButton onClick={() => setShowComparisonModal(false)}>×</CloseButton>
                        <InfoBox>
                            <InfoTitle>🎯 Comparison Result</InfoTitle>
                            <div style={{ fontSize: '2rem', textAlign: 'center', margin: '2rem 0', fontWeight: 'bold' }}>
                                {comparisonResult.text}
                            </div>
                            <InfoText>
                                <strong>Transaction Hash:</strong>
                            </InfoText>
                            <MonospaceText>
                                <Link href={comparisonResult.explorerLink} target="_blank" rel="noopener noreferrer">
                                    {comparisonResult.txHash}
                                </Link>
                            </MonospaceText>
                            <InfoText style={{ marginTop: '1.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                                Both parties now know the comparison result without revealing their actual wealth values! 🎉
                            </InfoText>
                        </InfoBox>
                    </ModalContent>
                </ModalOverlay>
            )}

            {podTracker && podChainRpcUrl && (
                <PodRequestTracker
                    appChainId={podAppChainId}
                    appInboxAddress={podTracker.inboxAddress}
                    appRpcUrl={podChainRpcUrl}
                    requestIdBob={podTracker.requestIdBob}
                    inboxExplorerUrl={(addr) => ex.address(addr)}
                    podRequestExplorerUrl={pollsMpc ? ex.podRequest : undefined}
                    onSettled={handlePodTrackerSettled}
                />
            )}

            {/* Header Card - Centered */}
            <CardsContainer style={{ marginTop: '0', marginBottom: '2rem', maxWidth: '900px' }}>
                {/* Title Card */}
                <Card $maxWidth="100%" style={{ padding: '1.5rem', marginBottom: '0', textAlign: 'center' }}>
                    <TitleRow>
                        <HeaderTitle>💰 The Millionaires' Problem</HeaderTitle>
                        <InfoIcon onClick={() => setShowInfoModal(true)} title="How It Works">
                            ℹ️
                        </InfoIcon>
                    </TitleRow>
                    <HeaderSubTitle>Secure Multi-Party Computation with COTI Garbled Circuits</HeaderSubTitle>
                    <HeaderContract>
                        <Link
                            href={ex.address(contractAddress || '0x0000000000000000000000000000000000000000')}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {contractAddress || 'Not deployed'}
                        </Link>
                    </HeaderContract>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <SmallButton
                            onClick={handleReset}
                            disabled={globalLoading}
                        >
                            {globalLoading ? 'Resetting...' : 'Reset Contract'}
                        </SmallButton>
                        <SmallButton
                            onClick={handleCompareAlice}
                            disabled={globalLoading || !aliceSubmitted || !bobSubmitted}
                        >
                            {globalLoading ? 'Comparing...' : 'Alice richer than Bob?'}
                        </SmallButton>
                    </div>
                </Card>

                {/* Players Card */}
                <Card $maxWidth="100%" style={{ padding: '0 1rem 1rem 1rem', backgroundColor: 'transparent', boxShadow: 'none', border: 'none' }}>
                    <PlayerSection>
                        {/* Bob Section */}
                        <Card $maxWidth="100%" style={{ padding: '1.5rem' }}>
                            <PlayerHeader>
                                <PlayerAddress>
                                    {bobWallet?.address ? (
                                        <Link href={ex.address(bobWallet.address)} target="_blank" rel="noopener noreferrer">
                                            Bob:
                                            <br />
                                            {bobWallet.address}
                                        </Link>
                                    ) : (
                                        'Address not configured'
                                    )}
                                </PlayerAddress>
                            </PlayerHeader>

                            <FormGroup>
                                {podDecimalWealthUi ? (
                                    <>
                                        <PlayerFormInput
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            placeholder="e.g. 12.5"
                                            value={bobSubmitted ? "••••••••" : bobWealth}
                                            onChange={(e) => setBobWealth(e.target.value)}
                                            disabled={bobSubmitted}
                                        />
                                    </>
                                ) : (
                                    <PlayerFormInput
                                        type={bobSubmitted ? 'text' : 'number'}
                                        placeholder="Amount"
                                        min="0"
                                        value={bobSubmitted ? "••••••••" : bobWealth}
                                        onChange={(e) => setBobWealth(e.target.value)}
                                        disabled={bobSubmitted}
                                    />
                                )}
                            </FormGroup>

                            <ButtonGroup style={{ justifyContent: 'center' }}>
                                <PlayerButton
                                    onClick={handleSubmitBobWealth}
                                    disabled={bobLoading || bobSubmitted}
                                >
                                    {bobLoading ? 'Submitting...' : 'Submit'}
                                </PlayerButton>
                            </ButtonGroup>

                            {bobStatus && (
                                <StatusMessage $variant={bobStatusVariant}>
                                    {bobStatus}
                                </StatusMessage>
                            )}
                        </Card>

                        {/* Alice Section */}
                        <Card $maxWidth="100%" style={{ padding: '1.5rem' }}>
                            <PlayerHeader>
                                <PlayerAddress>
                                    {aliceWallet?.address ? (
                                        <Link
                                            href={ex.address(aliceWallet.address)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Alice:
                                            <br />
                                            {aliceWallet.address}
                                        </Link>
                                    ) : (
                                        'Address not configured'
                                    )}
                                </PlayerAddress>
                            </PlayerHeader>

                            <FormGroup>
                                {podDecimalWealthUi ? (
                                    <>
                                        <PlayerFormInput
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            placeholder="e.g. 12.5"
                                            value={aliceSubmitted ? "••••••••" : aliceWealth}
                                            onChange={(e) => setAliceWealth(e.target.value)}
                                            disabled={aliceSubmitted}
                                        />
                                    </>
                                ) : (
                                    <PlayerFormInput
                                        type={aliceSubmitted ? 'text' : 'number'}
                                        placeholder="Amount"
                                        min="0"
                                        value={aliceSubmitted ? "••••••••" : aliceWealth}
                                        onChange={(e) => setAliceWealth(e.target.value)}
                                        disabled={aliceSubmitted}
                                    />
                                )}
                            </FormGroup>

                            <ButtonGroup style={{ justifyContent: 'center' }}>
                                <PlayerButton
                                    onClick={handleSubmitAliceWealth}
                                    disabled={aliceLoading || aliceSubmitted}
                                >
                                    {aliceLoading ? 'Submitting...' : 'Submit'}
                                </PlayerButton>
                            </ButtonGroup>

                            {aliceStatus && (
                                <StatusMessage $variant={aliceStatusVariant}>
                                    {aliceStatus}
                                </StatusMessage>
                            )}
                        </Card>
                    </PlayerSection>
                </Card>
            </CardsContainer>

            {/* Bottom Status Bar */}
            {connectionStatus && (
                <BottomStatusBar
                    $variant={connectionStatus.includes('Contract reset successfully') ? 'info' : connectionStatus.includes('✅') ? 'success' : connectionStatus.includes('❌') ? 'error' : 'info'}
                >
                    {connectionStatus}
                </BottomStatusBar>
            )}
        </AppContainer>
    )
}
