# System Architecture & Project State (Memory)

## Welcome Back!
If you are reading this in a new conversation, here is exactly where we left off:
1. **Smart Contract Upgraded:** We just fixed a major vulnerability where revoking a user's whitelist status would freeze their existing dTSLA tokens. We upgraded the UUPS Proxy on Arbitrum Sepolia to a new implementation that reverts `setWhitelist(false)` if the user holds a balance or pending deposits.
2. **Frontend ABI Updated:** We updated `frontend/src/constants/dTSLA_ABI.json` with the new custom errors (`dTSLA__HasBalance`, `dTSLA__HasPendingDeposits`).
3. **Escrow Flow Deployed:** The entire two-step Mint and Redeem escrow flow is written.
4. **Current Focus / Next Steps:** 
   - **End-to-End Testing:** We need to perform a full E2E test of the Mint and Redeem cycle.
   - **Alpaca Reconciliation:** We need to build a fallback loop (Lazy Reconciliation) just in case the Alpaca WebSocket drops a fill event. 

## 1. The Escrow Architecture (Minting & Redeeming)
We completely ripped out Chainlink Functions and replaced it with a Web2-driven Two-Step Escrow to prevent the "Weekend Problem" (unbacked assets trading on DEXs).
- **Deposit:** User calls `depositForMint()` on the contract. USDC is locked in the contract vault.
- **Backend Order:** The `indexer.js` hears the `DepositReceived` event. It places an order on Alpaca using the blockchain transaction hash as the `client_order_id`. Status is set to `PENDING` in the DB.
- **WebSocket Fill:** `indexer.js` listens to Alpaca WebSockets. When the order fills, it finds the DB record via `client_order_id` and marks it `READY_TO_CLAIM`.
- **Claim:** The user clicks "Claim" on the frontend. The GraphQL API generates an EIP-712 signature. The user sends the signature to `claimMint()` on the contract, which mints the dTSLA.

## 2. Admin Dashboard & Whitelisting
- **Whitelists:** Only whitelisted users and smart contracts can `deposit` or `mint`. Whitelist status does *not* affect `redeem` (since USDC transfers are permissionless).
- **Contracts vs EOAs:** The admin dashboard can whitelist both users (EOAs) and Protocols (Contracts). EOA whitelists sync via Privy and PostgreSQL. Protocol whitelists are stored in the `whitelisted_contracts` Postgres table.
- **Revocation Safety:** The smart contract prevents setting `isWhitelisted = false` if the account holds `dTSLA` or has pending USDC deposits.

## 3. High-Level Tech Stack
- **Database:** PostgreSQL (with `rwa_db`). Uses UUIDs, idempotent transactions, and tracks sync status.
- **Backend:** Node.js + Apollo GraphQL. Uses Privy JWTs for strict authentication (`context.user`).
- **Frontend:** React + Next.js + Apollo Client + viem + wagmi.
- **Smart Contracts:** Foundry, Solidity ^0.8.25. UUPS Upgradeable. 
  - **Proxy:** `0xd0AE4d1f4B03fcF186091090ba0b2688f9644C94` (Arbitrum Sepolia)
  - **Newest Implementation:** `0x0deef642003268d8610e189277ab4cec0a3c9900`
