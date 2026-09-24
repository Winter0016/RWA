const pool = require('./db');
const { getAvailableFiat, getTslaPrice } = require('./alpaca');
const { redisClient } = require('./redis');
const { privateKeyToAccount } = require('viem/accounts');
const { keccak256, encodePacked, parseEther, parseUnits } = require('viem');

const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY_ARBITRUM;
// The oracle account object
const oracleAccount = privateKeyToAccount(`0x${ORACLE_PRIVATE_KEY}`);

const resolvers = {
  Query: {
    users: async (_, args, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      const { rows } = await pool.query('SELECT * FROM users');
      return rows;
    },
    userBySigner: async (_, { signer_address }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE signer_address = $1',
        [signer_address]
      );
      return rows[0] || null;
    },
    getClaimSignature: async (_, { transactionHash }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      // 1. Fetch the transaction
      const txRes = await pool.query('SELECT * FROM transactions WHERE blockchain_tx = $1', [transactionHash]);
      if (txRes.rows.length === 0) {
        throw new Error("Transaction not found");
      }

      const tx = txRes.rows[0];

      // 2. Ensure it's ready to claim
      if (tx.status !== 'READY_TO_CLAIM') {
        throw new Error(`Transaction is not ready to claim. Current status: ${tx.status}`);
      }

      // 3. Fetch the user's wallet address
      const userRes = await pool.query('SELECT wallet_address FROM users WHERE id = $1', [tx.user_id]);
      if (userRes.rows.length === 0) {
        throw new Error("User not found for this transaction");
      }
      const wallet_address = userRes.rows[0].wallet_address;

      if (!wallet_address) {
        throw new Error("User does not have a connected wallet address");
      }

      // 4. Generate Signature
      const timestamp = Math.floor(Date.now() / 1000);

      // keccak256(abi.encodePacked(msg.sender, usdcConsumed, dTslaAmount, timestamp, "claimMint"))
      const messageHash = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256', 'uint256', 'string'],
          [
            wallet_address,
            parseUnits(tx.usdc_amount.toString(), 6), // USDC uses 6 decimals
            parseEther(tx.dtsla_amount.toString()),
            BigInt(timestamp),
            "claimMint"
          ]
        )
      );

      // Sign the raw hash (viem automatically prepends the Ethereum Signed Message prefix)
      const signature = await oracleAccount.signMessage({ message: { raw: messageHash } });

      return {
        usdcAmount: tx.usdc_amount,
        dTslaAmount: tx.dtsla_amount,
        timestamp,
        signature
      };
    },
    getClaimUSDCSignature: async (_, { transactionHash }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      // 1. Fetch the transaction
      const txRes = await pool.query('SELECT * FROM transactions WHERE blockchain_tx = $1', [transactionHash]);
      if (txRes.rows.length === 0) {
        throw new Error("Transaction not found");
      }

      const tx = txRes.rows[0];

      // 2. Ensure it's ready to claim
      if (tx.status !== 'READY_TO_CLAIM_USDC') {
        throw new Error(`Transaction is not ready to claim. Current status: ${tx.status}`);
      }

      // 3. Fetch the user's wallet address
      const userRes = await pool.query('SELECT wallet_address FROM users WHERE id = $1', [tx.user_id]);
      if (userRes.rows.length === 0) {
        throw new Error("User not found for this transaction");
      }
      const wallet_address = userRes.rows[0].wallet_address;

      if (!wallet_address) {
        throw new Error("User does not have a connected wallet address");
      }

      // 4. Generate Signature
      const timestamp = Math.floor(Date.now() / 1000);

      // keccak256(abi.encodePacked(msg.sender, dTslaAmount, usdcAmount, timestamp, "redeem"))
      const messageHash = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256', 'uint256', 'string'],
          [
            wallet_address,
            parseEther(tx.dtsla_amount.toString()),
            parseUnits(tx.usdc_amount.toString(), 6), // USDC uses 6 decimals
            BigInt(timestamp),
            "redeem"
          ]
        )
      );

      // Sign the raw hash (viem automatically prepends the Ethereum Signed Message prefix)
      const signature = await oracleAccount.signMessage({ message: { raw: messageHash } });

      return {
        usdcAmount: tx.usdc_amount,
        dTslaAmount: tx.dtsla_amount,
        timestamp,
        signature
      };
    },
    getRefundSignature: async (_, { transactionHash }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      // 1. Fetch the transaction
      const txRes = await pool.query('SELECT * FROM transactions WHERE blockchain_tx = $1', [transactionHash]);
      if (txRes.rows.length === 0) {
        throw new Error("Transaction not found");
      }

      const tx = txRes.rows[0];

      // 2. Ensure it's FAILED or CANCELED_BY_ADMIN (meaning Alpaca rejected it)
      if (tx.status !== 'FAILED' && tx.status !== 'CANCELED_BY_ADMIN') {
        throw new Error(`Transaction is not FAILED or CANCELED. Cannot refund. Current status: ${tx.status}`);
      }

      // 3. Fetch the user's wallet address
      const userRes = await pool.query('SELECT wallet_address FROM users WHERE id = $1', [tx.user_id]);
      if (userRes.rows.length === 0) {
        throw new Error("User not found for this transaction");
      }
      const wallet_address = userRes.rows[0].wallet_address;

      if (!wallet_address) {
        throw new Error("User does not have a connected wallet address");
      }

      // 4. Generate Signature based on Type
      const timestamp = Math.floor(Date.now() / 1000);
      let messageHash;

      if (tx.type === 'MINT') {
        // keccak256(abi.encodePacked(msg.sender, usdcAmount, timestamp, "cancelMint"))
        messageHash = keccak256(
          encodePacked(
            ['address', 'uint256', 'uint256', 'string'],
            [
              wallet_address,
              parseUnits(tx.usdc_amount.toString(), 6), // USDC uses 6 decimals
              BigInt(timestamp),
              "cancelMint"
            ]
          )
        );
      } else if (tx.type === 'REDEEM') {
        // keccak256(abi.encodePacked(msg.sender, dTslaAmount, timestamp, "cancelRedeem"))
        messageHash = keccak256(
          encodePacked(
            ['address', 'uint256', 'uint256', 'string'],
            [
              wallet_address,
              parseEther(tx.dtsla_amount.toString()),
              BigInt(timestamp),
              "cancelRedeem"
            ]
          )
        );
      } else {
        throw new Error("Unknown transaction type");
      }

      // Sign the raw hash
      const signature = await oracleAccount.signMessage({ message: { raw: messageHash } });

      return {
        usdcAmount: tx.usdc_amount,
        dTslaAmount: tx.dtsla_amount,
        timestamp,
        signature
      };
    },
    getUserTransactions: async (_, __, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");

      // Look up the database UUID using the secure Privy ID from the JWT
      const userRes = await pool.query('SELECT id FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0) throw new Error("User profile not found in database");

      const dbUserId = userRes.rows[0].id;

      const { rows } = await pool.query(
        'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
        [dbUserId]
      );
      return rows;
    },
    getAllUsers: async (_, __, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      const userRes = await pool.query('SELECT role FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
        throw new Error("UNAUTHORIZED Admin Only");
      }

      const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
      return rows;
    },
    getAllTransactions: async (_, __, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      const userRes = await pool.query('SELECT role FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
        throw new Error("UNAUTHORIZED");
      }

      const { rows } = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
      return rows;
    },
    getAllContracts: async (_, __, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      const userRes = await pool.query('SELECT role FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
        throw new Error("UNAUTHORIZED");
      }

      const { rows } = await pool.query('SELECT * FROM whitelisted_contracts ORDER BY created_at DESC');
      return rows;
    },
    getTslaPrice: async () => {
      try {
        const price = await getTslaPrice();
        return price;
      } catch (err) {
        console.error("Error fetching TSLA price in resolver:", err);
        return 0.0;
      }
    }
  },
  Mutation: {
    reserveMintPower: async (_, { usdcAmount, wallet_address }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      if (!wallet_address) throw new Error("Wallet address is required");

      // SECURITY PATCH: Verify the requested wallet_address belongs to the logged-in user
      const userRes = await pool.query('SELECT wallet_address FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0) throw new Error("User profile not found in database");

      const realWallet = userRes.rows[0].wallet_address;
      if (!realWallet || realWallet.toLowerCase() !== wallet_address.toLowerCase()) {
        throw new Error(`UNAUTHORIZED: You are trying to mint to a wallet you don't own (${wallet_address})`);
      }

      // 1. Get real cash balance from Alpaca
      const availableFiat = await getAvailableFiat();

      // 2. Atomically reserve the fiat first (Solves the Race Condition!)
      const newReservedFiat = await redisClient.incrByFloat('alpaca:reserved_buying_power', usdcAmount);
      
      const unreservedFiat = availableFiat - newReservedFiat;
      if (unreservedFiat < 0) {
        // Rollback the reservation since it exceeds buying power
        await redisClient.incrByFloat('alpaca:reserved_buying_power', -usdcAmount);
        throw new Error(`Insufficient Buying Power. Available: $${availableFiat - (newReservedFiat - usdcAmount)}`);
      }

      // 3. Generate Oracle Signature (The UUID)
      const timestamp = Math.floor(Date.now() / 1000);

      const messageHash = keccak256(
        encodePacked(
          ['address', 'uint256', 'uint256', 'string'],
          [
            wallet_address,
            parseUnits(usdcAmount.toString(), 6),
            BigInt(timestamp),
            "depositForMint"
          ]
        )
      );

      const signature = await oracleAccount.signMessage({ message: { raw: messageHash } });

      // 4. Save to Redis using the Signature as the key with a 5-minute TTL!
      // (The global counter was already incremented atomically above)
      await redisClient.setEx(`Lock:${signature}`, 300, usdcAmount.toString());

      console.log(`🔒 Reserved $${usdcAmount} (Lock TTL: 5m)`);

      // 5. Fallback setTimeout to decrement the global counter if the Lock expires
      // (Since Redis keys auto-delete, the Lock itself is safe, but we need to fix the global math)
      setTimeout(async () => {
        const status = await redisClient.get(`Lock:${signature}`);
        if (status !== "COMPLETED") { // If it timed out or is still PENDING...
          await redisClient.incrByFloat('alpaca:reserved_buying_power', -usdcAmount);
          console.log(`🔓 5-Min Timeout: Released $${usdcAmount} back to global pool.`);
        }
        await redisClient.del(`Lock:${signature}`); // Clean up
      }, 5 * 60 * 1000);

      return {
        usdcAmount,
        dTslaAmount: 0, // Not known yet
        timestamp,
        signature
      };
    },
    addUser: async (_, { email, name, signer_address, wallet_address }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");
      const privy_id = context.user.privyUserId;

      // SECURITY PATCH: Verify the user actually owns the signer_address they are trying to inject!
      const privyUser = await context.privy.getUser(privy_id);

      // Extract all verified wallet addresses attached to this Privy account
      const verifiedWallets = privyUser.linkedAccounts
        .filter(a => a.type === 'wallet')
        .map(a => a.address.toLowerCase());

      if (!verifiedWallets.includes(signer_address.toLowerCase())) {
        throw new Error("HACKER DETECTED: You do not own this wallet address!");
      }

      // 1. Check if user already exists using ONLY the unforgeable privy_id
      const check = await pool.query('SELECT * FROM users WHERE privy_id = $1', [privy_id]);
      if (check.rows.length > 0) {
        const existingUser = check.rows[0];

        if (wallet_address && existingUser.wallet_address !== wallet_address) {
          const update = await pool.query('UPDATE users SET wallet_address = $1 WHERE id = $2 RETURNING *', [wallet_address, existingUser.id]);
          console.log(`🔄 Updated User Wallet in DB: ${existingUser.name}`);
          return update.rows[0];
        }
        return existingUser;
      }

      // 1.5. Legacy User Account Takeover Prevention
      // If we got here, they don't have a row with their privy_id.
      // We check if a row exists with their signer_address (a legacy account).
      // Since we ALREADY cryptographically verified they own this signer_address above,
      // it is mathematically safe to backfill their new privy_id to this row!
      const legacyCheck = await pool.query('SELECT * FROM users WHERE signer_address = $1 AND privy_id IS NULL', [signer_address]);
      if (legacyCheck.rows.length > 0) {
        const legacyUser = legacyCheck.rows[0];
        await pool.query('UPDATE users SET privy_id = $1 WHERE id = $2', [privy_id, legacyUser.id]);
        console.log(`🔄 SECURELY backfilled privy_id for legacy user: ${legacyUser.name}`);

        if (wallet_address && legacyUser.wallet_address !== wallet_address) {
          await pool.query('UPDATE users SET wallet_address = $1 WHERE id = $2', [wallet_address, legacyUser.id]);
        }
        return { ...legacyUser, privy_id, wallet_address: wallet_address || legacyUser.wallet_address };
      }

      // 2. Insert new user with their unforgeable privy_id
      const { rows } = await pool.query(
        `INSERT INTO users (email, name, signer_address, wallet_address, privy_id) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [email, name, signer_address, wallet_address, privy_id]
      );

      console.log(`🎉 New User Created in DB: ${name}`);
      return rows[0];
    },
    upsertContract: async (_, { contract_address, name, is_whitelisted }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");

      const userRes = await pool.query('SELECT role FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
        throw new Error("UNAUTHORIZED Admin Only");
      }

      // Upsert query using PostgreSQL ON CONFLICT
      const { rows } = await pool.query(
        `INSERT INTO whitelisted_contracts (contract_address, name, is_whitelisted, updated_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
         ON CONFLICT (contract_address) 
         DO UPDATE SET name = EXCLUDED.name, is_whitelisted = EXCLUDED.is_whitelisted, updated_at = CURRENT_TIMESTAMP 
         RETURNING *`,
        [contract_address.toLowerCase(), name, is_whitelisted]
      );

      console.log(`✅ Upserted Protocol Contract: ${name} (${contract_address}) -> ${is_whitelisted}`);
      return rows[0];
    },
    updateUserWhitelist: async (_, { wallet_address, is_whitelisted }, context) => {
      if (!context.user) throw new Error("UNAUTHENTICATED");

      const userRes = await pool.query('SELECT role FROM users WHERE privy_id = $1', [context.user.privyUserId]);
      if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
        throw new Error("UNAUTHORIZED Admin Only");
      }

      const { rows } = await pool.query(
        `UPDATE users 
         SET is_whitelisted = $1, whitelist_updated_at = extract(epoch from now()) * 1000 
         WHERE wallet_address = $2 
         RETURNING *`,
        [is_whitelisted, wallet_address]
      );

      if (rows.length === 0) {
        throw new Error("User not found or no matching wallet address");
      }

      console.log(`✅ Updated User Whitelist: ${wallet_address} -> ${is_whitelisted}`);
      return rows[0];
    }
  }
};

module.exports = resolvers;
