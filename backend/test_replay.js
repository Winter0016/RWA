const axios = require('axios');

const GRAPHQL_URL = 'http://localhost:4000/graphql';

// Replace with a valid blockchain_tx in your database that is in CANCELED_BY_USER or FAILED status
const TEST_TX_HASH = '0xfbb3bf6cbc2688515e3b65d9470ff167bda5d963f0c880423052fafbab62f5fa';

// The Privy JWT Token from the frontend (requires a valid user)
// You can get this from the 'Authorization' header of any GraphQL request in your browser's Network tab.
const TEST_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkRpY0ZINDlxdXh4MFcyTE5kTl8tTU1YMElKQ2lOd20zRzQ4dTdLeFU5OEEifQ.eyJzaWQiOiJjbXVsNGp4YzUwMzg5MGNpOW53aGZpNm82IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3OTA2MDE0NjIsImF1ZCI6ImNtdTZtYXF1bDAwMmkwY2pwc3FiYzF4eGEiLCJzdWIiOiJkaWQ6cHJpdnk6Y211ODgzM28xMDNmOTBkbDgzN2dtMjc5ZCIsImV4cCI6MTc5MDYwNTA2Mn0.HlsB9jn-NP40jzt9XqnE_1cS1T5vviN7O3UcSBtQ4ZUyjUTPN6wvaunWHrzu0KjFjY9Ozqx4v_llC9FGqiU8tA';

async function testReplayAttack() {
  const query = `
    query GetRefundSignature($transactionHash: String!) {
      getRefundSignature(transactionHash: $transactionHash) {
        signature
      }
    }
  `;

  const variables = { transactionHash: TEST_TX_HASH };

  console.log(`Firing 5 concurrent requests for tx: ${TEST_TX_HASH}...`);

  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      axios.post(GRAPHQL_URL, { query, variables }, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      }).catch(err => err.response?.data || err.message)
    );
  }

  const results = await Promise.all(promises);

  console.log("\nResults from concurrent requests:");

  const uniqueSignatures = new Set();

  results.forEach((res, index) => {
    if (res && res.data && res.data.getRefundSignature) {
      const sig = res.data.getRefundSignature.signature;
      console.log(`Request ${index + 1}: ${sig.slice(0, 15)}...${sig.slice(-10)}`);
      uniqueSignatures.add(sig);
    } else {
      console.log(`Request ${index + 1}: Failed/Error:`, JSON.stringify(res));
    }
  });

  console.log(`\nTotal unique signatures generated: ${uniqueSignatures.size}`);

  if (uniqueSignatures.size > 1) {
    console.log("❌ REPLAY ATTACK SUCCESSFUL! The race condition bypassed the Redis cache.");
  } else if (uniqueSignatures.size === 1) {
    console.log("✅ SYSTEM SECURE! Only one signature was generated.");
  } else {
    console.log("⚠️ No valid signatures were returned. Did you paste a valid Privy Token and Transaction Hash?");
  }
}

testReplayAttack();
