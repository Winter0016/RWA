const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rwa_db',
  port: 5432,
  password: process.env.DB_PASSWORD
});

// Test the connection
pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL (rwa_db)'))
  .catch((err) => console.error('❌ Database connection error', err.stack));

module.exports = pool;
