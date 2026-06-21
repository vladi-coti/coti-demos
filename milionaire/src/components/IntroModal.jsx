import React, { useState } from 'react'
import styled from 'styled-components'
import {
    InfoBox,
    InfoTitle,
    InfoText,
    List,
    ListItem,
    Link
} from './styles.js'

const Overlay = styled.div`
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
  padding: 1rem;
`

const ModalContainer = styled.div`
  background: ${props => props.theme.colors.card.default};
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
`

const ModalTitle = styled.h2`
  color: ${props => props.theme.colors.text.default};
  font-size: 1.8rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1.5rem;
`

const CheckboxContainer = styled.label`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  color: ${props => props.theme.colors.text.default};
`

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
`

const SmallActionButton = styled.button`
  background-color: #1E29F6;
  border: none;
  border-radius: 12px;
  padding: 0.5rem 1.5rem;
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
`

const STORAGE_KEY = 'millionaire_intro_dismissed'

function IntroModal({ onClose, useContractHook }) {
    const [isOpen, setIsOpen] = useState(true)
    const [isResetting, setIsResetting] = useState(false)
    const [resetStatus, setResetStatus] = useState('')
    const { resetContract, checkWealthStatus } = useContractHook()

    const handleClose = async () => {
        // Reset contract when closing the modal
        setIsResetting(true)
        setResetStatus('Resetting contract...')
        
        try {
            console.log('Initiating contract reset from modal...')
            await resetContract()
            
            // Wait a moment for blockchain state to update
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Verify the reset was successful
            setResetStatus('Verifying reset...')
            console.log('Verifying contract reset...')
            let status = await checkWealthStatus()
            
            // Retry up to 3 times if verification fails
            let retries = 0
            while ((status.aliceSet || status.bobSet) && retries < 3) {
                console.warn(`Contract reset verification failed (attempt ${retries + 1}) - wealth values still set, retrying...`)
                setResetStatus(`Retrying reset (${retries + 1}/3)...`)
                await resetContract()
                await new Promise(resolve => setTimeout(resolve, 1500))
                status = await checkWealthStatus()
                retries++
            }
            
            if (status.aliceSet || status.bobSet) {
                console.error('Contract reset failed after retries')
                setResetStatus('Reset may not have completed. Please try the Reset button.')
            } else {
                console.log('Contract reset verified successfully')
                setResetStatus('Reset complete!')
            }
            
            // Notify parent to refresh state
            if (onClose) {
                onClose()
            }
        } catch (error) {
            console.error('Error resetting contract:', error)
            setResetStatus('Reset failed. Please use the Reset button.')
            // Still notify parent even on failure
            if (onClose) {
                onClose()
            }
        } finally {
            setIsResetting(false)
            setIsOpen(false)
        }
    }

    if (!isOpen) return null

    return (
        <Overlay>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalTitle>💰 The Millionaires' Problem</ModalTitle>
                
                <InfoBox>
                    <InfoTitle>🔐 What is the Millionaires' Problem?</InfoTitle>
                    <InfoText>
                        The Millionaires' Problem, introduced by Andrew Yao in 1982, is a foundational
                        problem in secure multi-party computation (MPC).
                    </InfoText>
                    <InfoText style={{ marginTop: '1rem' }}>
                        <strong>The Scenario:</strong>
                    </InfoText>
                    <List>
                        <ListItem>Two millionaires, Alice and Bob, want to know who is richer</ListItem>
                        <ListItem>Neither wants to reveal their actual wealth</ListItem>
                        <ListItem>They need to compare values without exposing them</ListItem>
                    </List>
                    <InfoText style={{ marginTop: '1rem' }}>
                        <strong>The Solution:</strong>
                    </InfoText>
                    <InfoText>
                        Using COTI's Garbled Circuits (GC) implementation of MPC, we can perform
                        this comparison on-chain while keeping both wealth values encrypted
                        throughout the entire process!
                    </InfoText>
                    <InfoText style={{ marginTop: '1rem' }}>
                        <Link
                            href="https://en.wikipedia.org/wiki/Yao%27s_Millionaires%27_problem"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            📚 Learn more about Yao's Millionaires' Problem
                        </Link>
                    </InfoText>
                </InfoBox>

                <ButtonContainer>
                    <SmallActionButton
                        onClick={handleClose}
                        disabled={isResetting}
                    >
                        {isResetting ? resetStatus : "Got it! Let's compare wealth →"}
                    </SmallActionButton>
                </ButtonContainer>
            </ModalContainer>
        </Overlay>
    )
}

export default IntroModal
