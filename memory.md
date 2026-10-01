# System Architecture & Project State (Memory)

## Welcome Back!
If you are reading this in a new conversation, here is exactly where we left off:
1. **Security Hardening Completed:** We successfully patched all GraphQL race conditions (using Redis Mutex Locks), removed all client-side wallet dependencies (Zero-Trust JWT), and implemented backend decimal truncation to fix BigInt math crashing.
2. **UI & UX Polish:** The frontend has been cleaned up. We removed unnecessary tabs (like "Trade") and polished the transaction history UI so users clearly see *why* an order failed (e.g., `Failed`, `Canceled by System`, `Canceled by You`) and can request a refund cleanly.
3. **Smart Contract Upgraded:** The UUPS Proxy on Arbitrum Sepolia is fully stable. It includes `s_usedSignatures` replay protection and strict whitelist asset freezing protection.
4. **Current Focus / Next Steps:** 
   - **Portfolio Demo:** The user is currently preparing to record a local video demo of the project for their portfolio, using `demo_checklist.md` as the script.
   - **Deployment (Optional):** We discussed deploying to Vercel (frontend) and Render/Railway (backend) with Supabase + Upstash, though the user opted for a local video demo to save on infrastructure costs.

## 1. The Escrow Architecture (Minting & Redeeming)
We completely ripped out Chainlink Functions and replaced it with a Web2-driven Two-Step Escrow to prevent the "Weekend Problem" (unbacked assets trading on DEXs).
- **Deposit:** User calls `depositForMint()` on the contract. USDC is locked in the contract vault.
- **Backend Order:** The `indexer.js` hears the `DepositReceived` event. It places an order on Alpaca using the blockchain transaction hash as the `client_order_id`. Status is set to `PENDING` in the DB.
- **WebSocket Fill/Fail:** `indexer.js` listens to Alpaca WebSockets. When the order fills, it finds the DB record via `client_order_id` and marks it `READY_TO_CLAIM`. If it fails/cancels, it marks it `FAILED` so the user can claim a refund.
- **Claim:** The user clicks "Claim" on the frontend. The GraphQL API generates an EIP-712 signature (using a Zero-Trust JWT and Redis locks). The user sends the signature to `claimMint()` on the contract, which mints the dTSLA.

## 2. Admin Dashboard & Whitelisting
- **Whitelists:** Only whitelisted users and smart contracts can `deposit` or `mint`. Whitelist status does *not* affect `redeem` (since USDC transfers are permissionless).
- **Contracts vs EOAs:** The admin dashboard can whitelist both users (EOAs) and Protocols (Contracts). EOA whitelists sync via Privy and PostgreSQL. Protocol whitelists are stored in the `whitelisted_contracts` Postgres table.
- **Revocation Safety:** The smart contract prevents setting `isWhitelisted = false` if the account holds `dTSLA` or has pending USDC deposits.

## 3. High-Level Tech Stack
- **Database:** PostgreSQL (with `rwa_db`). Uses UUIDs, idempotent transactions, and tracks sync status.
- **Backend:** Node.js + Apollo GraphQL. Uses Privy JWTs for strict authentication (`context.user`) and Redis for Distributed Mutex locking and caching.
- **Frontend:** React + Next.js + Apollo Client + viem + wagmi + Pimlico (Account Abstraction ERC-4337).
- **Smart Contracts:** Foundry, Solidity ^0.8.25. UUPS Upgradeable. 
  - **Proxy:** `0x1d4706e883278417825232846f1e9C106003aea9` (Arbitrum Sepolia)
  - **Implementation:** `0x0deef642003268d8610e189277ab4cec0a3c9900`
