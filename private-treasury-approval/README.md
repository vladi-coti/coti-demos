# Private Treasury Approval Demo

A frontend-first demo shell for the `PrivateTreasuryApproval` example from `../pod-mpc-lib`.

This is not a fake mockup. It drives the real flow:

1. Fund the source-chain treasury
2. Create a payout proposal on the source chain
3. Register the proposal on COTI through the inbox/executor flow
4. Submit an encrypted private approval
5. Finalize after the voting deadline
6. Execute the payout if the threshold is met

## What This Demo Is

- A standalone sibling package modeled on `milionaire/`
- A real React UI for owner + approver roles
- A minimal contract/deploy setup for the treasury approval pair
- A testnet-oriented shell that makes pending cross-chain states visible

## What This Demo Is Not

- It does not bundle the full `pod-mpc-lib` system-test harness
- It does not auto-run relay infrastructure for you
- It does not hide callback delays behind fake “instant success” UI
- It is not a full committee management product

## Networks

- Source chain: Sepolia
- MPC side: COTI Testnet

## Installation

```bash
cd private-treasury-approval
npm install
cp .env.example .env
```

## Environment Variables

### Frontend

```env
VITE_SOURCE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
VITE_COTI_RPC_URL=https://testnet.coti.io/rpc

VITE_OWNER_PK=...
VITE_OWNER_AES_KEY=...
VITE_APPROVER_PK=...
VITE_APPROVER_AES_KEY=...

VITE_SOURCE_CONTRACT_ADDRESS=0x...
VITE_COTI_CONTRACT_ADDRESS=0x...
VITE_COTI_INBOX_ADDRESS=0x...

VITE_CALLBACK_FEE_WEI=1000000000000000
VITE_CREATE_TOTAL_FEE_WEI=3000000000000000
VITE_APPROVAL_TOTAL_FEE_WEI=3000000000000000
VITE_FINALIZE_TOTAL_FEE_WEI=3000000000000000
```

### Deploy Scripts

```env
DEPLOYER_PRIVATE_KEY=...
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
COTI_TESTNET_RPC_URL=https://testnet.coti.io/rpc

SEPOLIA_INBOX_ADDRESS=0x...
COTI_INBOX_ADDRESS=0x...
PRIVATE_TREASURY_APPROVAL_COTI_ADDRESS=0x...
COTI_CHAIN_ID=7082400
```

## Wallet Rules

Use the same EOA for each role across both networks if you want decryption to work cleanly.

- `OWNER_PK` / `OWNER_AES_KEY`: source owner actions + COTI tally decryption
- `APPROVER_PK` / `APPROVER_AES_KEY`: source approval tx + COTI vote encryption/decryption

If you mix source-chain and COTI identities for the same role, you are asking for pain.

## Deployment Order

### 1. Deploy the COTI-side contract

```bash
npm run deploy:coti
```

This deploys `PrivateTreasuryApprovalCoti` using `COTI_INBOX_ADDRESS`.

Copy the deployed address into:

```env
PRIVATE_TREASURY_APPROVAL_COTI_ADDRESS=0x...
VITE_COTI_CONTRACT_ADDRESS=0x...
```

### 2. Deploy the source-chain contract

```bash
npm run deploy:source
```

This deploys `PrivateTreasuryApproval` on Sepolia using `SEPOLIA_INBOX_ADDRESS`, then calls:

- `configure(address(0), PRIVATE_TREASURY_APPROVAL_COTI_ADDRESS, COTI_CHAIN_ID)`

Copy the deployed address into:

```env
VITE_SOURCE_CONTRACT_ADDRESS=0x...
```

## Run The App

```bash
npm run dev
```

The app will run on `http://localhost:3006`.

## How The UI Works

### Owner Flow

- Fund the treasury contract with ETH
- Create a proposal with recipient, amount, threshold, deadline, and approvers
- Refresh until remote registration finishes
- Finalize after the deadline
- Execute if the proposal was approved
- Decrypt yes/no tallies after finalization

### Approver Flow

- Load the same proposal id
- Submit an encrypted yes/no vote
- Refresh until the approval callback lands
- Decrypt the recorded vote receipt

### Status Flow

The page deliberately exposes:

- pending register request id
- pending finalize request id
- pending approver request id
- pending approval count
- current proposal flags (`registered`, `finalized`, `approved`, `executed`)

That is intentional. This workflow is asynchronous, so the UI keeps pending request IDs and state flags visible while callbacks are processed.

## Important Caveats

### Cross-chain callbacks are not instant

If registration, approval, or finalization is still pending:

- wait for the callback infrastructure to process the inbox request
- click `Refresh`
- only retry if the request is clearly stuck

### Fee values are env-driven

This demo does not estimate two-way inbox fees dynamically. It uses explicit env values:

- `VITE_CALLBACK_FEE_WEI`
- `VITE_CREATE_TOTAL_FEE_WEI`
- `VITE_APPROVAL_TOTAL_FEE_WEI`
- `VITE_FINALIZE_TOTAL_FEE_WEI`

If these are too low, transactions will fail.

### Encryption path for approvals

The private yes/no vote is encrypted against the COTI inbox `batchProcessRequests(...)` selector, not the source treasury contract. That is required for the `itBool` approval payload to survive the inbox/executor path.

## Available Scripts

- `npm run compile` - compile contracts
- `npm run build` - build frontend
- `npm run dev` - run the Vite dev server
- `npm run deploy:coti` - deploy the COTI-side tally contract
- `npm run deploy:source` - deploy and configure the source treasury contract

## Verification Done In This Repo

- `npm run compile`
- `npm run build`

No high-value local relay test was added here, because this package is meant to stay a focused demo shell instead of duplicating `pod-mpc-lib`’s heavier system-test machinery.
