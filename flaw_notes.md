# Architectural Flaws Identified & Resolved

### 1. The "Unbacked Asset" Vulnerability (The Weekend Problem) - ✅ RESOLVED
- **Flaw:** Tokens were minted instantly before Alpaca secured the stock.
- **Fix:** Implemented the Two-Step Escrow Architecture (`depositForMint` -> Alpaca Execution -> `claimMint`). No tokens exist until stock is physically held.

### 2. The Smart Contract Accounting Bug - ✅ RESOLVED
- **Flaw:** USDC was swept to the Admin instead of the Vault.
- **Fix:** Modified `dTSLA.sol` to hold funds in `address(this)` for proper redemption backing.

### 3. The Redis Lock "Zombie" Bug (Denial of Service) - ✅ RESOLVED
- **Flaw:** Redis buying power locks never expired.
- **Fix:** Implemented a 5-minute expiration (TTL) on the Redis lock, perfectly mirroring the signature expiration.

### 4. No GraphQL Authentication - ✅ RESOLVED
- **Flaw:** Apollo Server was fully public.
- **Fix:** Implemented Privy JWT verification in Apollo Server context. All restricted mutations and queries now check `context.user`.

### 5. Whitelist Revocation Asset Freezing - ✅ RESOLVED
- **Flaw:** `_update` hook enforced whitelist checks on all token movements. If an admin revoked whitelist status, the user's funds were frozen permanently.
- **Fix:** `setWhitelist` in `dTSLA.sol` now strictly checks if the user has a balance or pending deposits, reverting if they do. Admin must force user to redeem or burn before revoking.

### 6. Missing Alpaca Reconciliation - ✅ RESOLVED
- **Flaw:** If the Alpaca WebSocket drops connection during a fill event, the user's deposit gets permanently stuck in `PENDING` and they can never claim their dTSLA.
- **Fix:** Built a "Lazy Reconciliation" loop that hits the database every 60 seconds, but ONLY makes an API call to Alpaca if the transaction has been stuck for > 5 minutes. Protects API limits while guaranteeing eventual consistency.

### 7. No Price Slippage Protection - ⚠️ OUTSTANDING
- **Flaw:** Market orders are vulnerable to weekend gap-ups.
- **Fix Needed:** Require user to deposit a USDC buffer, or utilize Limit orders on Alpaca.
