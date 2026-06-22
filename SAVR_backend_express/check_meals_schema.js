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
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meals'");
    console.log('meals columns:', res.rows);
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meal_ingredients'");
    console.log('meal_ingredients columns:', res2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
