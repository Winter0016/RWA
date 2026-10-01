# Video Demo Showcase Checklist

This is your master script for recording the perfect 3-to-5 minute portfolio video. It covers the "happy paths," the advanced security mechanisms you built, and the edge cases that prove your system is production-ready. 

*Tip: Keep your backend terminal logs visible on half the screen during the demo. Recruiters love seeing the blockchain events trigger the Web2 logs in real-time.*

## 1. Core User Experience (The "Happy Path" & UX)
- [ ] **Gasless Web3 Onboarding:** Show a user logging in via Privy. Emphasize that they don't need ETH for gas because your ERC-4337 Paymaster (Pimlico) handles it natively in USDC.
- [ ] **Minting dTSLA (Market Open):** Execute a `depositForMint`. Show the UI updating, and point to the terminal to show `indexer.js` catching the blockchain event and routing it to the Alpaca API instantly.
- [ ] **Redeeming dTSLA (Market Open):** Execute a `redeem`. Show the Alpaca sell order filling, and the user calling `claimUSDC` to pull the funds out of the smart contract.

## 2. Admin & Protocol Controls
- [ ] **Admin Dashboard View:** Log into the Admin panel to view the global transaction feed across all users.
- [ ] **Whitelisting:** Show the admin approving/whitelisting a new user wallet to interact with the protocol.
- [ ] **Emergency Pause:** Demonstrate the Admin pausing the smart contract (if implemented) or halting the Oracle, proving you understand emergency protocol security.

## 3. Real-World API Edge Cases (Alpaca Handling)
- [ ] **Market Closed Scenario:** Attempt a `depositForMint` when the Alpaca market is closed. Show the transaction entering the `PENDING_ALPACA` state.
- [ ] **User Cancellation:** While the market is closed and the order is `PENDING_ALPACA`, show the user clicking "Cancel Order" on the frontend. Show the backend actively canceling it on Alpaca and allowing the user to claim a refund signature.
- [ ] **Alpaca Rejection (Mint then Redeem fast):** Show a user trying to `Mint`, and then immediately trying to cancel/redeem it before the stock settles, forcing Alpaca to reject it. Show the WebSocket catching the `rejected` status, marking it as `FAILED` in the database, and the new UI displaying the `[ Failed ]` badge with a `[ REFUND ]` button.

## 4. Hardcore Security & Zero-Trust Architecture (The "Flex" Section)
- [ ] **The Race Condition Attack:** Run `node test_replay.js` in the terminal. Show 5 concurrent requests hitting the GraphQL API in the same millisecond. Point out the Redis Mutex Lock blocking 4 of them and only returning 1 signature, completely neutralizing the TOCTOU (Time-of-Check to Time-of-Use) exploit.
- [ ] **Smart Contract Signature Replay:** Try to submit the exact same valid signature to the smart contract twice (or manually call `depositForMint` with a used signature). Show the transaction reverting because of your `s_usedSignatures` mapping.
- [ ] **JWT Authentication Attack:** Open an API testing tool (like Postman or GraphQL Playground). Try to query another user's transactions or request a refund without a valid Privy JWT token. Show the API rejecting it with `UNAUTHENTICATED`. Explain that your backend derives the wallet address *directly from the secure token*, making client-side spoofing impossible.
- [ ] **Decimal Truncation Precision:** Briefly mention (or show) a transaction with extreme fractional dust (e.g., `0.000000000001` shares) and how your backend string-truncation logic safely parses it for the blockchain without throwing BigInt math errors.
- [ ] **Backend Fault-Tolerance (Crash Simulation):** Get your JWT, turn OFF the Node.js backend entirely, and manually execute a `depositForMint` on the smart contract. Wait for it to confirm, then reboot the backend. Show how `indexer.js` checks the `indexer_state` table, instantly catches up on the missed blocks, processes the deposit, and buys the stock anyway without data loss.

---

### Suggested Video Flow:
1. **0:00 - 0:30:** High-level pitch (RWA protocol connecting Arbitrum to real US stocks via Alpaca, using ERC-4337 for gasless UX).
2. **0:30 - 1:30:** Show the Happy Path (Minting/Redeeming while pointing out the backend indexer logs).
3. **1:30 - 2:30:** Show the Edge Cases (Market closed, Alpaca rejections, and how cleanly the user can refund their locked USDC).
4. **2:30 - 3:30:** Show the Security (Run the race-condition test script and demonstrate the JWT zero-trust API).
5. **3:30+:** Show the Admin dashboard and close out.
