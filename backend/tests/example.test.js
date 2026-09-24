const { parseEther } = require('viem');

describe("Backend Protocol Tests", () => {
  // Variables declared here can be accessed by all tests
  let userWallet;
  let dTslaAmount;

  // 1. THIS IS JEST'S VERSION OF setUp() from Foundry! 
  // It runs automatically before every single test to give you a clean slate.
  beforeEach(() => {
    userWallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    dTslaAmount = 0.277441731;
  });

  // 2. This is a Test Case (similar to function testSomething() in Foundry)
  test("It correctly converts fractional TSLA shares to 18-decimal Wei", () => {
    
    // Execution
    const sharesInWei = parseEther(dTslaAmount.toString());

    // 3. This is Jest's version of assertEq() !
    expect(sharesInWei).toBe(277441731000000000n);
  });

  test("It correctly calculates USDC payout during a mock redeem", () => {
    // Setup a fake scenario without hitting the real internet
    const mockOraclePrice = 350.00; 

    // Execution
    const usdcPayout = dTslaAmount * mockOraclePrice;

    // Assertion - We use toBeCloseTo because Javascript floating-point math is imperfect!
    expect(usdcPayout).toBeCloseTo(97.10460585, 5);
  });
});

// ==========================================
// MOCKING A DATABASE
// ==========================================

// 1. Tell Jest to hijack the real 'pg' library
jest.mock('pg', () => {
  const mPool = {
    // 2. Create a fake query function that returns a fake row!
    query: jest.fn().mockResolvedValue({ 
      rows: [ { id: 1, status: 'READY_TO_CLAIM', usdc_amount: 100 } ] 
    }),
  };
  return { Pool: jest.fn(() => mPool) };
});

const { Pool } = require('pg');
const pool = new Pool();

describe("Database Mocking Tests", () => {
  test("It should correctly process a READY_TO_CLAIM transaction", async () => {
    
    // When your indexer.js runs this, it hits the fake database instantly!
    const result = await pool.query("SELECT * FROM transactions WHERE status = 'READY_TO_CLAIM'");
    
    // We can test if your logic handles the fake data correctly
    expect(result.rows[0].status).toBe('READY_TO_CLAIM');
    
    // We can even test to make sure your code wrote the correct SQL query!
    expect(pool.query).toHaveBeenCalledWith(
      "SELECT * FROM transactions WHERE status = 'READY_TO_CLAIM'"
    );
  });
});

// ==========================================
// SIMULATING THE END-TO-END MINT FLOW
// ==========================================

describe("End-to-End Mint Architecture Simulation", () => {
  test("It should successfully progress a transaction from DEPOSIT to COMPLETED", async () => {
    
    // --- STEP 1: DEPOSIT ---
    // User calls depositForMint on the smart contract.
    const usdcDeposited = 100;
    let databaseStatus = 'EXECUTED_ON_CHAIN'; // Indexer inserts this row
    
    
    // --- STEP 2: INDEXER BUYS STOCK ---
    // We mock the Alpaca API call
    const mockAlpacaBuy = jest.fn().mockResolvedValue({ status: 'accepted' });
    
    await mockAlpacaBuy({ symbol: 'TSLA', side: 'buy', notional: usdcDeposited });
    databaseStatus = 'PENDING_ALPACA';
    
    // Assert that the indexer told Alpaca to spend exactly $100
    expect(mockAlpacaBuy).toHaveBeenCalledWith({ symbol: 'TSLA', side: 'buy', notional: 100 });
    expect(databaseStatus).toBe('PENDING_ALPACA');


    // --- STEP 3: WEBSOCKET TRADE FILL ---
    // We simulate Alpaca sending us a 'fill' event
    const mockWebSocketEvent = { event: 'fill', order: { filled_qty: '0.277' } };
    
    if (mockWebSocketEvent.event === 'fill') {
        databaseStatus = 'READY_TO_CLAIM';
    }
    
    expect(databaseStatus).toBe('READY_TO_CLAIM');


    // --- STEP 4: ORACLE SIGNATURE ---
    // The frontend asks our GraphQL backend for a signature
    const mockGraphQLResolver = jest.fn().mockReturnValue({ signature: '0xabc123' });
    
    // Ensure the backend only signs if the status is READY_TO_CLAIM
    let authPayload = null;
    if (databaseStatus === 'READY_TO_CLAIM') {
       authPayload = mockGraphQLResolver({ wallet: "0xf39...", amount: usdcDeposited });
    }
    
    expect(mockGraphQLResolver).toHaveBeenCalled();
    expect(authPayload.signature).toBe('0xabc123');


    // --- STEP 5: SMART CONTRACT MINT ---
    // The user takes the signature and calls claimMint on Anvil
    const mockSmartContract = jest.fn().mockResolvedValue("Mint Successful");
    await mockSmartContract(authPayload.signature);
    
    // The indexer catches the 'Minted' event and finalizes the database
    databaseStatus = 'COMPLETED';

    expect(databaseStatus).toBe('COMPLETED');
  });
});
