# Hackathon Project: Real World Assets (dTesla)

## 📌 The Problem
Traditional finance requires users to navigate complex brokerage accounts, undergo lengthy KYC processes, and hold fiat currencies to buy stocks. Web3 users want to gain exposure to real-world assets (RWA) like Tesla stock, but they want to keep their assets on-chain to use in the broader DeFi ecosystem (like lending and borrowing).

## 💡 The Solution
A Real World Asset (RWA) platform that allows users to seamlessly purchase `dTesla` tokens. Each `dTesla` token is 1:1 backed by real Tesla stock held in a traditional brokerage account (managed via the Alpaca API).

Users pay for the asset using the official Circle Testnet USDC token. The entire process uses Account Abstraction (ERC-20 Paymaster) to allow users to pay for their gas fees directly in USDC, providing a Web2-like checkout experience with the benefits of Web3 composability. 

## 🏗️ The Tech Stack (PERN-G + Web3)

### 1. Account Abstraction (Privy + Pimlico)
- **Target Audience:** Web2 users who want exposure to stocks on-chain but don't want to manage private keys or ETH gas.
- **Privy:** Users log in with their email. A Smart Account (ERC-4337) is automatically generated for them in the background. No MetaMask required.
- **Paymaster (ERC-20 Gas):** When a user buys dTesla, they pay the network gas fee using their testnet USDC. The Pimlico Paymaster handles the conversion to ETH under the hood. The user never needs native tokens.

### 2. Backend (Node.js + PostgreSQL + GraphQL)
- **Node.js (Express):** Acts as the fast Web2 layer. It listens to blockchain events to index data, and acts as the "Treasury" that transfers official Testnet USDC to users when they use the Mock Stripe Checkout.
- **PostgreSQL (Indexer):** Acts as an indexer, caching user balances, pending transactions, and whitelist statuses.
- **GraphQL (Apollo):** Serves the indexed user data and token supply metrics incredibly fast to the React frontend. Fully secured by Privy JWTs.

### 3. Frontend (React.js)
- **Admin Dashboard:** A private page for the platform administrator to view the total `dTesla` supply, all user balances, and manage protocol/user whitelists.
- **User Page:** A seamless storefront where users can input how much `dTesla` they want to buy. Utilizes a Two-Step Escrow architecture to guarantee 1:1 backing.

### 4. Smart Contracts (Solidity on Arbitrum Sepolia)
- `dTSLA.sol`: A UUPS Upgradeable ERC20 token contract. Employs a Two-Step Escrow architecture:
  1. User deposits USDC into the Vault.
  2. The Node.js backend hears the event, executes the trade on Alpaca, and signs an EIP-712 payload.
  3. User submits the signature to the blockchain to mint their dTSLA, completely eliminating counterparty execution risk.
