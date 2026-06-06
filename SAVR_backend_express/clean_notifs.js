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
    const res = await pool.query("DELETE FROM notifications WHERE title = 'Food Donation Cancelled'");
    console.log(`Deleted ${res.rowCount} redundant notifications.`);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
