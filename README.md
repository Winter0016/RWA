# 🏎️ dTesla: Web3 Real World Assets (RWA)

**dTesla** is a full-stack Real World Asset (RWA) platform that allows users to seamlessly purchase synthetic tokens (`dTSLA`) backed 1:1 by real Tesla stock held in a traditional brokerage account. 

By utilizing Account Abstraction (ERC-4337) and a custom Two-Step Escrow architecture, users experience a gasless, Web2-like checkout flow while maintaining full Web3 composability.

## 📌 The Problem
Traditional finance requires users to navigate complex brokerage accounts, undergo lengthy KYC processes, and hold fiat currencies to buy stocks. Web3 users want to gain exposure to real-world assets (like TSLA) but want to keep their assets on-chain to use in the broader DeFi ecosystem (lending, borrowing, etc.).

## 💡 The Solution
A decentralized protocol where users pay for assets using Circle's official Testnet USDC. The entire process uses Account Abstraction (ERC-20 Paymaster) so users pay for their gas fees directly in USDC. The underlying collateral (real TSLA shares) is automatically bought and sold in real-time via the Alpaca Trading API, guaranteeing 1:1 backing.

---

## 🏗️ The Tech Stack

### 1. Account Abstraction (Privy + Pimlico)
- **Target Audience:** Web2 users who want exposure to stocks on-chain but don't want to manage private keys or ETH gas.
- **Privy:** Users log in with their email. A Smart Account (ERC-4337) is automatically generated for them in the background. No MetaMask required.
- **Paymaster (ERC-20 Gas):** When a user buys dTesla, they pay the network gas fee using their testnet USDC. The Pimlico Paymaster handles the conversion to ETH under the hood. The user never needs native tokens.

### 2. Backend (Node.js + PostgreSQL + Redis + GraphQL)
- **Node.js (Express & Viem):** Acts as the fast Web2 layer. It listens to blockchain events to index data in real-time.
- **Alpaca API:** The backend instantly executes live market buys and sells for real TSLA stock to collateralize the tokens.
- **PostgreSQL:** Acts as a relational indexer, caching user balances, pending transaction states (Pending, Completed, Refunded, Canceled), and whitelist statuses.
- **Redis:** Manages atomic check-and-reserve locks to prevent race conditions when executing live brokerage trades.
- **GraphQL (Apollo):** Serves the indexed user data and token supply metrics incredibly fast to the Next.js frontend. Secured by Privy JWT authentication.

### 3. Frontend (Next.js + Tailwind CSS)
- **Admin Dashboard:** A private page for the platform administrator to view the total `dTSLA` supply, all user balances, and manage protocol/user whitelists.
- **User Portfolio & Market:** A seamless storefront where users can view live TSLA prices, seamlessly execute 2-step gasless transactions, and request refunds if trades fail.
- **State Machines:** Highly resilient UI state flows to handle complex multi-step blockchain transactions with explicit UI feedback.

### 4. Smart Contracts (Foundry / Arbitrum Sepolia)
- **dTSLA.sol:** A UUPS Upgradeable ERC20 token contract utilizing a custom Two-Step Escrow architecture to completely eliminate counterparty execution risk:
  1. **Deposit:** User deposits USDC into the Vault on-chain.
  2. **Execute:** The Node.js backend hears the event, executes the stock trade on Alpaca, and signs an EIP-712 payload proving collateralization.
  3. **Claim:** User submits the Oracle signature to the blockchain to mint their dTSLA.
  4. **Refund:** If the brokerage trade fails, users can effortlessly claim a full USDC refund using an Oracle signature.

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm
- PostgreSQL
- Redis
- Foundry (for smart contracts)

### Environment Variables
You will need API keys for:
- [Alpaca Markets](https://alpaca.markets/) (Paper Trading)
- [Privy](https://privy.io/) (Authentication & Smart Accounts)
- [Pimlico](https://pimlico.io/) (ERC-4337 Paymaster)

*(Please see the `.env.example` files in the respective directories for required variables).*

### Running Locally

**1. Start the Backend:**
```bash
cd backend
npm install
node index.js
node indexer.js
```

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**3. Deploy Smart Contracts (Optional):**
```bash
cd contracts
forge install
forge build
```
