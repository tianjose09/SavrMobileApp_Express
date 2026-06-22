require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function run() {
  try {
    // Add column if it doesn't exist
    await pool.query(`
      ALTER TABLE meals 
      ADD COLUMN IF NOT EXISTS image_url text;
    `);
    console.log('Successfully added image_url column to meals table!');
  } catch (e) {
    console.error('Error adding column:', e);
  } finally {
    await pool.end();
  }
}
run();
