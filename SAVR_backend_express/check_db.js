require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM food_donations LIMIT 1');
    console.log('QueryResult:', res.rows);
  } catch (e) {
    console.error('Error querying food_donations:', e);
  } finally {
    await pool.end();
  }
}
run();
