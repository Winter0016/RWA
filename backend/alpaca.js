const { Alpaca } = require('@alpacahq/alpaca-trade-api');
require('dotenv').config();

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secret: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

async function getAvailableFiat() {
  try {
    const account = await alpaca.trading.account.getAccount();
    
    if (account.status !== 'ACTIVE') {
      throw new Error("Alpaca account is not active.");
    }
    if (account.tradingBlocked) {
      throw new Error("Trading is currently blocked by Alpaca.");
    }

    const availableCash = parseFloat(account.cash);
    console.log(`💰 Real Alpaca Cash Available: $${availableCash}`);
    return availableCash;
  } catch (error) {
    console.error("❌ Failed to fetch Alpaca account:", error.message);
    throw error;
  }
}

async function getTslaPrice() {
  try {
    const price = await alpaca.marketData.getLatestPrice("TSLA");
    console.log(`📈 Live TSLA Price: $${price}`);
    return price;
  } catch (error) {
    console.error("❌ Failed to fetch TSLA price:", error.message);
    throw error;
  }
}

module.exports = {
  alpaca,
  getAvailableFiat,
  getTslaPrice
};
