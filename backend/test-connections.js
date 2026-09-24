const { connectRedis, redisClient } = require('./redis');
const { getAvailableFiat } = require('./alpaca');
require('dotenv').config();

async function testConnections() {
  console.log("Starting Connection Tests...\n");

  // 1. Test Redis
  try {
    console.log("⏳ Testing Redis Connection...");
    await connectRedis();
    
    // Check if we can read the lock
    const pool = await redisClient.get('alpaca:reserved_buying_power');
    console.log(`✅ Redis is working! Current reserved pool: $${pool}\n`);
  } catch (error) {
    console.error("❌ Redis Connection Failed. Is your Redis server running?");
    console.error(error.message, "\n");
  }

  // 2. Test Alpaca
  try {
    console.log("⏳ Testing Alpaca Connection...");
    if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_SECRET_KEY) {
      throw new Error("Missing ALPACA_API_KEY or ALPACA_SECRET_KEY in your .env file!");
    }
    
    await getAvailableFiat();
    console.log("✅ Alpaca is working!\n");
  } catch (error) {
    console.error("❌ Alpaca Connection Failed.");
    if (error.message.includes("401")) {
      console.error("Your API keys might be invalid or you forgot to set them in the .env file.");
    }
  }

  process.exit();
}

testConnections();
