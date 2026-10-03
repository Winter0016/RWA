const typeDefs = `#graphql
  # -----------------------------------------
  # TYPES (Data Models)
  # -----------------------------------------
  
  type User {
    id: ID!
    email: String
    name: String
    signer_address: String!
    wallet_address: String
    created_at: String!
    role: String!
    is_whitelisted: Boolean
    whitelist_updated_at: String
  }

  enum TransactionType {
    MINT
    REDEEM
  }

  enum TransactionStatus {
    PENDING_ALPACA
    READY_TO_CLAIM
    READY_TO_CLAIM_USDC
    COMPLETED
    FAILED
    REFUNDED
    CANCELED_BY_ADMIN
    CANCELED_BY_USER
  }

  type Transaction {
    id: ID!
    user_id: ID!
    wallet_address: String
    type: TransactionType!
    usdc_amount: String!
    dtsla_amount: String!
    status: TransactionStatus!
    blockchain_tx: String
    created_at: String!
  }

  type Quote {
    usdcAmount: String!
    dTslaAmount: String!
    timestamp: Float!
    signature: String!
  }

  type WhitelistedContract {
    id: ID!
    contract_address: String!
    name: String!
    is_whitelisted: Boolean
    created_at: String
    updated_at: String
  }

  # -----------------------------------------
  # QUERIES (Read Data)
  # -----------------------------------------
  type Query {
    # Get all users
    users: [User]
    
    # Get a specific user by their Privy Wallet Address
    userBySigner(signer_address: String!): User

    # Get stateless quotes (Does NOT save to DB)
    getClaimSignature(transactionHash: String!): Quote
    getClaimUSDCSignature(transactionHash: String!): Quote
    getRefundSignature(transactionHash: String!): Quote

    # Get transaction history for the authenticated user
    getUserTransactions: [Transaction]

    # Admin: Get all users
    getAllUsers: [User]

    # Admin: Get all transactions globally
    getAllTransactions: [Transaction]

    # Admin: Get all tracked protocol contracts
    getAllContracts: [WhitelistedContract]

    # Get live TSLA price from Alpaca API
    getTslaPrice: Float!
  }

  # -----------------------------------------
  # MUTATIONS (Write Data)
  # -----------------------------------------
  type Mutation {
    # Called by frontend to lock fiat balance BEFORE depositing on-chain
    reserveMintPower(usdcAmount: String!, wallet_address: String!): Quote
    
    # Called when a user logs in for the very first time
    addUser(
      email: String, 
      name: String, 
      signer_address: String!, 
      wallet_address: String
    ): User


    # User actively cancels a pending order (e.g. before Alpaca fills it)
    cancelPendingTransaction(transactionHash: String!): Quote
  }
`;

module.exports = typeDefs;
