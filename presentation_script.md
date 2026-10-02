# Video Presentation Guide (Talking Points)

*Keep this open on a second monitor or notepad while recording. Don't read it word-for-word, just use it to guide your flow!*

## 1. The Hook & Introduction (0:00 - 0:45)
- **What to say:** "Hi, I'm [Your Name]. This is my Real World Asset (RWA) protocol that bridges real US stocks, like Tesla, onto the Arbitrum blockchain."
- **What to show:** Open the Frontend UI.
- **The Flex:** Explain that Web3 onboarding is broken and users shouldn't need ETH to buy stocks. Then say: *"Users can sign up with a Google account with Privy, or use a MetaMask EOA if they have one. Privy will automatically make an EOA based on their Google account, and then Pimlico will create a Smart Wallet account for the user to interact with the blockchain and store their tokens. Pimlico also acts as the Paymaster so they never pay gas in ETH."*

## 2. The Architecture (0:45 - 1:30)
- **What to say:** "Before I show the demo, let me explain how I eliminated Counterparty Risk."
- **What to show:** Open your GitHub `README.md` and show the **Minting ASCII Diagram**.
- **The Flex:** Explain the **Two-Step Escrow**. "Usually, RWA protocols take your money and *promise* to mint you tokens. In my system, the user locks USDC in the smart contract. My Node.js indexer catches this, buys the real stock on the Alpaca API, and only then generates a cryptographic EIP-712 signature. The user uses this signature to claim their tokens. It is mathematically impossible for them to lose their money if the backend fails."

## 3. The Happy Path Demo (1:30 - 2:30)
- **What to say:** "Let's see it in action."
- **What to show:** Split your screen: Frontend UI on the left, your Backend Terminal (`indexer.js`) on the right.
- **The Action:** Execute a **Deposit**. Point to the terminal as the `DepositReceived` log fires. Point out the Alpaca buy order executing.
- **The Flex:** Show the UI instantly updating via WebSockets, allowing you to click "Claim" to finish the minting. "The GraphQL backend is entirely Zero-Trust. It derives the wallet address straight from the Privy JWT, meaning no one can spoof signatures."

## 4. The Edge Cases & Resiliency (2:30 - 3:30)
- **What to say:** "A production system has to handle failures gracefully. What happens if the stock market is closed?"
- **What to show:** Execute a deposit (or cancel an existing pending one). 
- **The Flex:** Show how the system marks it as `PENDING_ALPACA`. Show the user hitting the "Cancel" button, and the smart contract cleanly refunding their USDC. "Users are never trapped."

## 5. The Ultimate Flex: Server Crash (3:30 - 4:30)
- **What to say:** "Finally, I built a highly fault-tolerant event indexer."
- **What to show:** Go to your terminal and `Ctrl+C` to KILL `indexer.js`.
- **The Action:** Make a deposit on the frontend. The UI hangs. Say: "Oh no, the server crashed while the user was depositing!"
- **The Flex:** Turn `indexer.js` back on. Point to the terminal as it prints `Syncing backlog...`. "When the server reboots, it queries PostgreSQL for the last processed block, realizes it missed a transaction, and instantly catches up. Zero data loss."

## 6. Outro (4:30 - 5:00)
- **What to say:** "Thanks for watching. The admin dashboard is also fully built to track the global supply and whitelist DeFi protocols. Check out the Github link below for the full source code."
