const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { PrivyClient } = require('@privy-io/server-auth');

const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const { connectRedis, redisClient } = require('./redis');

// Initialize Privy client
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow Next.js frontend to connect
      methods: ["GET", "POST"]
    }
  });

  const { alpaca, getTslaPrice } = require('./alpaca');

  let currentTslaPrice = 0;
  
  // Prime the cache immediately when the server starts!
  // This ensures we have a price even if the market is closed and the WebSocket is silent.
  getTslaPrice().then(price => {
    currentTslaPrice = price;
    console.log(`🔌 Initial cache seeded with TSLA price: $${price}`);
  }).catch(err => console.error("Failed to seed initial price:", err));

  io.on('connection', async (socket) => {
    console.log(`🔌 Client connected to WebSocket: ${socket.id}`);

    // Instantly send the LAST KNOWN cached price so the frontend doesn't have to wait for the next tick!
    if (currentTslaPrice > 0) {
      socket.emit('stock_price_update', { ticker: 'TSLA', price: currentTslaPrice });
    }

    // Clients can join a "room" using their wallet address or user ID to get private updates
    socket.on('join_room', (walletAddress) => {
      socket.join(walletAddress.toLowerCase());
      console.log(`User joined room: ${walletAddress.toLowerCase()}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Alpaca WebSocket integration for real-time stock prices using `ws`
  const WebSocket = require('ws');

  // Connect to the free IEX data stream (or SIP if you have paid tier)
  const alpacaSocket = new WebSocket('wss://stream.data.alpaca.markets/v2/iex');

  alpacaSocket.on('open', () => {
    console.log("Connected to Alpaca Data Stream (ws)");

    // 1. Authenticate
    const authMsg = {
      action: 'auth',
      key: process.env.ALPACA_API_KEY,
      secret: process.env.ALPACA_SECRET_KEY
    };
    alpacaSocket.send(JSON.stringify(authMsg));
  });

  alpacaSocket.on('message', (data) => {
    const messages = JSON.parse(data);
    for (const msg of messages) {
      if (msg.T === 'success' && msg.msg === 'authenticated') {
        console.log("Alpaca Stream Authenticated! Subscribing to TSLA...");
        // 2. Subscribe to TSLA quotes
        const subMsg = {
          action: 'subscribe',
          quotes: ['TSLA']
        };
        alpacaSocket.send(JSON.stringify(subMsg));
      } else if (msg.T === 'q' && msg.S === 'TSLA') {
        // 'q' stands for quote. 'ap' is Ask Price.
        if (msg.ap) {
          currentTslaPrice = msg.ap; // Cache the latest price in memory!
          io.emit('stock_price_update', { ticker: 'TSLA', price: msg.ap });
        }
      } else if (msg.T === 'error') {
        console.error("Alpaca WS Error:", msg);
      }
    }
  });

  alpacaSocket.on('error', (err) => {
    console.error("Alpaca WebSocket error:", err);
  });

  // Initialize our Redis Cache / Lock
  await connectRedis();

  // Create a separate Redis connection for Pub/Sub
  const redisSubscriber = redisClient.duplicate();
  await redisSubscriber.connect();

  // Subscribe to transaction updates from the indexer
  await redisSubscriber.subscribe('transaction_updates', (message) => {
    try {
      const data = JSON.parse(message);
      
      // 🌐 Global broadcast for the Admin Dashboard!
      io.emit('global_transaction_update', data);

      if (data.walletAddress) {
        // Forward specific ready statuses to trigger signature fetching
        if (data.status === 'READY_TO_CLAIM' || data.status === 'READY_TO_CLAIM_USDC' || data.status === 'FAILED') {
          io.to(data.walletAddress.toLowerCase()).emit('transaction_ready', data);
        }
        
        // Forward all status updates so the UI can show progress bars (PENDING_ALPACA, COMPLETED)
        io.to(data.walletAddress.toLowerCase()).emit('transaction_update', data);
      }
    } catch (error) {
      console.error("Error parsing redis message:", error);
    }
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  // Set up Express to handle GraphQL requests
  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // `req.headers` contains the metadata (like our JWT token).
        // `req.body` contains the actual GraphQL payload (the query string and the variables).
        // Apollo automatically reads `req.body` and routes those variables to our resolvers for us!
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        let user = null;
        if (token) {
          try {
            // Verify the token using Privy
            const verifiedClaims = await privy.verifyAuthToken(token);
            user = { privyUserId: verifiedClaims.userId };
          } catch (error) {
            console.error("JWT Verification Error:", error.message);
          }
        }

        // Make user, req, and privy client available to resolvers
        return { user, req, privy };
      },
    }),
  );

  const PORT = process.env.PORT || 4000;
  // Make sure to listen on httpServer, not app!
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🚀 WebSocket server ready on port ${PORT}`);
  });
}

startServer();
