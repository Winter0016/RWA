require('dotenv').config();
const pool = require('./db');

async function run() {
  try {
    const res = await pool.query('SELECT * FROM transactions');
    console.log("TRANSACTIONS:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
