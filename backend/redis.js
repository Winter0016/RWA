const { createClient } = require('redis');

// Create a Redis client.
// By default, it connects to redis://localhost:6379
const redisClient = createClient();

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Connected to Redis'));

// A helper function to initialize Redis and our default values
async function connectRedis() {
  await redisClient.connect();
  
  // Initialize reserved buying power to 0 if it doesn't exist yet
  const exists = await redisClient.exists('alpaca:reserved_buying_power');
  if (!exists) {
    await redisClient.set('alpaca:reserved_buying_power', '0');
  }
}

module.exports = {
  redisClient,
  connectRedis
};
