const jwt = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkRpY0ZINDlxdXh4MFcyTE5kTl8tTU1YMElKQ2lOd20zRzQ4dTdLeFU5OEEifQ.eyJzaWQiOiJjbXVqdmp1d2UwMDZuMGNsODFicWo2OG9qIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3OTA1Nzc5NDQsImF1ZCI6ImNtdTZtYXF1bDAwMmkwY2pwc3FiYzF4eGEiLCJzdWIiOiJkaWQ6cHJpdnk6Y211NnZlYjh6MDBvbTBjbDVtNDk3ZmJ3dCIsImV4cCI6MTc5MDU4MTU0NH0.UFm20UWrO340MrQvVxRQvVxx22AdciOtemMmJvyV7MqJNSnDxF7FVE4_GfrZGZJ_HICOJlVHLZ9m2P2qN2DX7g"; // You need to grab your JWT from the browser network tab

const ENDPOINT = "http://localhost:4000/graphql";
const WALLET = "0x48002b5E034C50282ed0876968f63c93B625449c"; // Put your actual wallet address here

const query = `
  mutation ReserveMintPower($usdcAmount: Float!, $walletAddress: String!) {
    reserveMintPower(usdcAmount: $usdcAmount, wallet_address: $walletAddress) {
      timestamp
      signature
    }
  }
`;

const fireMutation = async (amount, id) => {
  try {
    console.log(`[Req ${id}] Firing request to reserve $${amount}...`);
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        query,
        variables: {
          usdcAmount: amount,
          walletAddress: WALLET
        }
      })
    });

    const result = await response.json();
    if (result.errors) {
      console.log(`❌ [Req ${id}] FAILED: ${result.errors[0].message}`);
    } else {
      console.log(`✅ [Req ${id}] SUCCESS: Reserved with signature ${result.data.reserveMintPower.signature.slice(0, 15)}...`);
    }
  } catch (err) {
    console.error(`❌ [Req ${id}] NETWORK ERROR:`, err.message);
  }
};

async function testRaceCondition() {
  console.log("🚀 Launching 20 simultaneous requests to test the Redis lock...");

  // Create an array of 20 identical requests trying to reserve $25,000 each.
  // 20 * $25,000 = $500,000. Since your Alpaca buying power is ~$400k,
  // the first ~16 will succeed, and the last ~4 MUST instantly fail!
  const requests = [];
  for (let i = 1; i <= 20; i++) {
    requests.push(fireMutation(25000.0, i)); // Request $25,000 each!
  }

  // Promise.all fires them concurrently at the exact same millisecond
  await Promise.all(requests);

  console.log("🏁 Race condition test complete.");
}

testRaceCondition();
